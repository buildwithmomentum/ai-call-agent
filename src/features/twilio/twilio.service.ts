import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as WebSocket from 'ws';
import { GrokService } from '../grok/grok.service';
import { ElevenLabsService } from '../elevenlabs/elevenlabs.service';
import { LLMProvider, ClientConnection, Message } from './types/twilio.types'; // Import the interfaces and Message type
import { AiStateHandler } from './handlers/ai-state.handler';
import { TwilioPhoneService } from './phone.service';
import { AgentConfigService } from '../agent-config/agent-config.service';
import { ToolsService } from '../tools/tools.service';
import { FunctionsService } from '../functions/functions.service';
import { CallSessionService, CallSession } from './call-session.service';
import { getClientIdFromSocket } from '../../utils/id-generator.util';

@Injectable()
export class TwilioService implements OnModuleInit {
  // Service logger
  private readonly logger = new Logger(TwilioService.name);
  
  // Logging control flags - all disabled by default
  private readonly ENABLE_FULL_LOGGING = false;
  private readonly ENABLE_AUDIO_LOGS = false;
  private readonly ENABLE_STREAMING_LOGS = false; 
  private readonly ENABLE_STATE_LOGS = false;     
  
  private clientConnections = new Map<string, ClientConnection>();
  private currentLLM: LLMProvider;
  private callConfigs = new Map<string, any>(); // Store config per callSid
  
  // Transcription prompt for OpenAI speech-to-text API
  private readonly transcriptionPrompt = "You are a helpful business receptionist assistant. The user may ask about booking appointments, scheduling dates, business hours, services offered, or general business inquiries. Please transcribe their speech accurately, paying special attention to dates, times, and specific business-related terms.";

  constructor(
    private readonly grokService: GrokService,
    private readonly elevenLabsService: ElevenLabsService,
    private readonly twilioPhoneService: TwilioPhoneService,
    private readonly agentConfigService: AgentConfigService,
    private readonly toolsService: ToolsService,
    private readonly functionsService: FunctionsService,
    private readonly callSessionService: CallSessionService
  ) {
    // Initialize with Grok as default LLM provider
    this.currentLLM = this.grokService;
  }

  onModuleInit() {
    // Validate environment variables on startup
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      this.logger.error('Missing OpenAI API key. Please set it in the environment variables.');
      process.exit(1);
    }

    // Start the stale connection monitor
    this.startConnectionMonitor();
  }

  // Monitor and clean up stale connections
  private startConnectionMonitor() {
    const MONITOR_INTERVAL = 60000; // Check every minute
    const CONNECTION_TIMEOUT = 300000; // 5 minutes of inactivity

    setInterval(() => {
      const now = Date.now();
      let staleCount = 0;

      // Check each connection for staleness
      this.clientConnections.forEach((connection, clientId) => {
        if (connection.lastActivity && (now - connection.lastActivity > CONNECTION_TIMEOUT)) {
          this.logger.warn(`Stale connection detected for client ${clientId}, inactive for ${Math.floor((now - connection.lastActivity) / 1000)} seconds`);
          
          // Clean up the connection resources
          if (connection.openAiWs && connection.openAiWs.readyState === WebSocket.OPEN) {
            connection.openAiWs.close(1000, 'Connection timeout due to inactivity');
          }
          
          if (connection.elevenLabsWs && connection.elevenLabsWs.readyState === WebSocket.OPEN) {
            connection.elevenLabsWs.close(1000, 'Connection timeout due to inactivity');
          }
          
          if (connection.heartbeatInterval) {
            clearInterval(connection.heartbeatInterval);
          }
          
          // End the call session if it exists
          if (connection.callSid) {
            this.callSessionService.endSession(connection.callSid);
            this.callConfigs.delete(connection.callSid);
          }
          
          // Remove the connection
          this.clientConnections.delete(clientId);
          staleCount++;
        }
      });

      if (staleCount > 0) {
        this.logger.log(`Cleaned up ${staleCount} stale connections. Active connections: ${this.clientConnections.size}`);
      }
    }, MONITOR_INTERVAL);
    
    this.logger.log('Connection monitor started');
  }

  //==============================
  // CORE CALL HANDLING METHODS
  //==============================

  // Sets up a new call session with the appropriate agent configuration
  async initializeCallSession(callSid: string, phoneNumber: string, fromNumber: string): Promise<string> {
    this.logger.log(`Initializing call: ${callSid} [To: ${phoneNumber}, From: ${fromNumber}]`);
    
    const agentId = await this.twilioPhoneService.getVoiceAgentIdByPhoneNumber(phoneNumber);
    if (!agentId) {
      this.logger.error(`No voice agent configured for number ${phoneNumber}`);
      throw new Error(`No voice agent configured for phone number ${phoneNumber}`);
    }

    // Create call session
    const session = this.callSessionService.createSession(callSid, agentId, fromNumber, phoneNumber);

    // Update configuration for this specific call
    await this.updateConfigForCall(callSid, agentId);

    // Log successful initialization
    this.logger.debug(`Configuration loaded for call ${callSid}`);
    return agentId;
  }

  // Retrieves voice agent ID from a phone number and loads its configuration
  async setVoiceAgentId(phoneNumber: string, callSid: string): Promise<string> {
    const id = await this.twilioPhoneService.getVoiceAgentIdByPhoneNumber(phoneNumber);
    if (!id) {
      this.logger.error(`No voice agent found for phone number ${phoneNumber}`);
      throw new Error(`No voice agent configured for phone number ${phoneNumber}`);
    }
    
    // Update configuration with agent settings for this call
    await this.updateConfigForCall(callSid, id);
    
    return id;
  }

  // Returns the TwiML response for incoming calls
  getTwimlResponse(host: string): string {
    const wsUrl = `wss://${host}/twilio/media-stream`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Amy-Neural">One moment please... Connecting you now.</Say>
    <Pause length="1"/>
    <Say voice="Polly.Amy-Neural">You can start talking now.</Say>
    <Connect>
        <Stream url="${wsUrl}" />
    </Connect>
</Response>`;
  }

  //==============================
  // LLM CONFIGURATION METHODS
  //==============================

  // Loads and updates LLM configuration from agent settings for a specific call
  async updateConfigForCall(callSid: string, agentId: string) {
    try {
      const [agentConfig, tools, functions] = await Promise.all([
        this.agentConfigService.getCachedAgentConfig(agentId),
        this.toolsService.getTools(agentId),
        this.functionsService.getFunctionsByAssistantId(agentId)
      ]);

      const functionData = functions || [];
      // Pass functions data to GrokService
      this.grokService.setFunctionsData(functionData);
      
      const modelSettings = agentConfig?.voiceAgent?.private_settings?.model;

      if (!modelSettings) {
        throw new Error('No model configuration found');
      }

      const config = {
        model: modelSettings.model,
        voice: modelSettings.voice,
        temperature: modelSettings.temperature,
        systemMessage: modelSettings.SYSTEM_MESSAGE,
        tools: tools,
        functionData: functionData
      };
      
      if (!config.systemMessage) {
        throw new Error('No system message found in config');
      }
      
      // Store the config for this specific call
      this.callConfigs.set(callSid, config);
      
      this.logger.debug(`Agent ${agentId} configuration loaded for call ${callSid}`);
    } catch (error) {
      this.logger.error(`Failed to load agent ${agentId} config: ${error.message}`);
      throw new Error(`Failed to initialize agent configuration: ${error.message}`);
    }
  }

  // Get config for a specific call
  getConfigForCall(callSid: string) {
    return this.callConfigs.get(callSid);
  }

  // Changes the LLM provider at runtime
  setLLMProvider(provider: LLMProvider) {
    this.currentLLM = provider;
  }

  //==============================
  // CLIENT CONNECTION MANAGEMENT
  //==============================

  // Creates new client state for a connection
  initializeClientState(streamSid: string = null) {
    return {
      streamSid,
      latestMediaTimestamp: 0,
      sessionId: null,
      isAiSpeaking: false,
      conversationHistory: []
    };
  }

  // Stores a client connection with association to a call
  setClientConnection(clientId: string, connection: ClientConnection, callSid: string) {
    // Update the lastActivity timestamp
    connection.lastActivity = Date.now();
    
    // If callSid is provided, set it on the connection
    if (callSid) {
      connection.callSid = callSid;
    }
    
    // Store the connection
    this.clientConnections.set(clientId, connection);
    
    // If we have a streamSid, associate it with the callSid
    if (connection.state.streamSid && connection.callSid) {
      this.callSessionService.associateStreamWithCall(connection.state.streamSid, connection.callSid);
    }
  }

  // Retrieves a client connection by ID
  getClientConnection(clientId: string) {
    return this.clientConnections.get(clientId);
  }

  // Removes a client connection
  removeClientConnection(clientId: string) {
    const connection = this.clientConnections.get(clientId);
    if (connection?.state?.streamSid) {
      // Get callSid from streamSid
      const callSession = this.callSessionService.getSessionByStreamSid(connection.state.streamSid);
      if (callSession) {
        // End the session when removing connection
        this.callSessionService.endSession(callSession.callSid);
        // Remove call config
        this.callConfigs.delete(callSession.callSid);
      }
    }
    this.clientConnections.delete(clientId);
  }

  //==============================
  // SPEECH GENERATION & STREAMING
  //==============================

  // Method to set voiceAgentId in GrokService and process AI response
  private async convertAndSendSpeech(client: WebSocket, content: string, state: any, callSid: string) {
    const clientId = getClientIdFromSocket(client);
    const connection = this.getClientConnection(clientId);
    
    try {
      if (!connection) {
        throw new Error(`No connection found for client ID: ${clientId}`);
      }
      
      // Get the call session to access the voiceAgentId
      const callSession = this.callSessionService.getSessionByCallSid(callSid);
      if (!callSession) {
        throw new Error(`No call session found for call: ${callSid}`);
      }
      
      // Set the voiceAgentId in GrokService
      this.grokService.setVoiceAgentId(callSession.agentId);

      AiStateHandler.setAiSpeaking(connection, true, 'Starting speech conversion', this.ENABLE_STATE_LOGS);
      
      if (!connection) {
        this.logger.error('Client connection not found');
        return;
      }

      if (!connection.elevenLabsWs || connection.elevenLabsWs.readyState !== WebSocket.OPEN) {
        this.logger.warn('ElevenLabs connection not found or not open, attempting to recreate');
        
        // Get config for voice settings
        const config = this.callConfigs.get(callSid);
        if (!config) {
          throw new Error('Configuration not found for call: ' + callSid);
        }
        
        // Create a new connection to ElevenLabs
        connection.elevenLabsWs = this.elevenLabsService.createWebSocketConnection({
          modelId: 'eleven_flash_v2_5',
          outputFormat: 'ulaw_8000',
          optimizeLatency: 4,
          autoMode: true,
          syncAlignment: false,
          textNormalization: 'off',
          inactivityTimeout: 180,
          voiceId: config.voice,
          onAudioChunk: (audioBuffer, isFinal, alignmentData) => {
            if (!audioBuffer) return;
            
            // Skip if this is the final message with no audio
            if (isFinal) return;
            
            // Check if we have a stream SID
            if (!state.streamSid) {
              AiStateHandler.resetAiSpeaking(connection, 'No stream SID available', this.ENABLE_STATE_LOGS);
              return;
            }
            
            if (!state.isAiSpeaking) {
              this.logger.debug('AI not in speaking state, skipping audio chunk');
              return;
            }
            
            // Base64 encode the audio chunk
            const base64Audio = audioBuffer.toString('base64');
            
            // Send to Twilio
            const mediaEvent = {
              event: 'media',
              streamSid: state.streamSid,
              media: {
                payload: base64Audio
              }
            };
            
            try {
              client.send(JSON.stringify(mediaEvent));
              if (this.ENABLE_AUDIO_LOGS) {
                this.logger.debug(`Sent audio chunk (${audioBuffer.length} bytes) to Twilio`);
              }
            } catch (error) {
              this.logger.error(`Error forwarding audio to Twilio: ${error.message}`);
            }
          },
          onError: (error) => {
            this.logger.error(`ElevenLabs WebSocket error: ${error.message}`);
          },
          onClose: () => {
            this.logger.debug('ElevenLabs WebSocket connection closed');
            AiStateHandler.resetAiSpeaking(connection, 'ElevenLabs connection closed', this.ENABLE_STATE_LOGS);
          }
        });
        
        // Update the connection
        this.setClientConnection(clientId, connection, callSid);
        
        // Wait for the connection to be established
        await new Promise((resolve) => {
          const checkConnection = () => {
            if (connection.elevenLabsWs.readyState === WebSocket.OPEN) {
              this.logger.debug('ElevenLabs connection established successfully');
              resolve(true);
            } else if (connection.elevenLabsWs.readyState === WebSocket.CLOSED || 
                      connection.elevenLabsWs.readyState === WebSocket.CLOSING) {
              this.logger.error('Failed to establish ElevenLabs connection');
              resolve(false);
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        });
      }
      
      if (!connection.elevenLabsWs || connection.elevenLabsWs.readyState !== WebSocket.OPEN) {
        this.logger.error('ElevenLabs connection still not available after recreation attempt');
        AiStateHandler.resetAiSpeaking(connection, 'ElevenLabs connection not available', this.ENABLE_STATE_LOGS);
        return;
      }

      this.logger.debug('Starting Grok response streaming');
      
      const lastUserMessage = state.conversationHistory.findLast(
        msg => msg.role === 'user'
      )?.content || '';
      
      if (!lastUserMessage) {
        this.logger.error('No user message found to respond to');
        AiStateHandler.resetAiSpeaking(connection, 'No user message found', this.ENABLE_STATE_LOGS);
        return;
      }

      let chunkBuffer = '';
      let fullResponse = '';
      
      // Patterns for natural chunking of text
      const sentenceEndPattern = /[.!?]["']?\s*$/;
      const strongPhrasePattern = /[,;:](?:\s|$)/;
      const naturalPausePattern = /(\sand\s|\sor\s|\sbut\s|\sbecause\s|\sthen\s)(?=\w)/i;
      
      const hasCompleteThought = (text: string): boolean => {
        // Complete sentence takes priority
        if (sentenceEndPattern.test(text)) {
          return true;
        }
        
        // For shorter text, require complete sentences
        if (text.length < 60) {
          return false;
        }
        
        // For medium length, accept strong phrase breaks
        if (text.length >= 60 && text.length < 100 && strongPhrasePattern.test(text)) {
          return true;
        }
        
        // For longer text, also accept natural pauses
        if (text.length >= 100) {
          return naturalPausePattern.test(text) || strongPhrasePattern.test(text);
        }
        
        return false;
      };
      
      const MAX_BUFFER_SIZE = 200; // Chunk size for streaming
      const MIN_CHUNK_SIZE = 30;   // Minimum chunk size
      
      const heartbeatInterval = setInterval(() => {
        if (connection.elevenLabsWs?.readyState === WebSocket.OPEN) {
          this.elevenLabsService.sendTextToWebSocket(
            connection.elevenLabsWs,
            " ",
            { tryTriggerGeneration: false }
          );
          if (this.ENABLE_STREAMING_LOGS) {
            console.log('💓 Sending heartbeat to ElevenLabs');
          }
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 60000);
      
      connection.heartbeatInterval = heartbeatInterval;

      // Get config for this specific call
      const config = this.callConfigs.get(callSid);
      if (!config) {
        throw new Error('Configuration not found for call: ' + callSid);
      }

      const { model, temperature, systemMessage, tools } = config;
      
      await this.grokService.streamResponseToHistory(
        lastUserMessage,
        (chunk) => {
          if (!connection.state.isAiSpeaking) {
            console.log('🛑 Streaming interrupted, not sending chunk to ElevenLabs');
            return;
          }
          
          chunkBuffer += chunk;
          fullResponse += chunk;
          
          // Clean up any double spaces or unnecessary whitespace
          chunkBuffer = chunkBuffer.replace(/\s+/g, ' ').trim();
          
          if ((hasCompleteThought(chunkBuffer) && chunkBuffer.length >= MIN_CHUNK_SIZE) || 
              chunkBuffer.length >= MAX_BUFFER_SIZE) {
            
            if (this.ENABLE_STREAMING_LOGS) {
              console.log(`📤 Streaming chunk to ElevenLabs (${chunkBuffer.length} chars): "${chunkBuffer}"`);
            }
            
            // Ensure proper punctuation before sending
            if (!sentenceEndPattern.test(chunkBuffer) && !strongPhrasePattern.test(chunkBuffer)) {
              chunkBuffer += ',';
            }
            
            this.elevenLabsService.sendTextToWebSocket(
              connection.elevenLabsWs, 
              chunkBuffer,
              {
                tryTriggerGeneration: chunkBuffer.length > MIN_CHUNK_SIZE
              }
            );
            
            chunkBuffer = '';
          }
        },
        systemMessage,
        model,
        temperature,
        state.conversationHistory,
        tools  // Pass the raw tools to GrokService
      );
      
      // Handle any remaining text
      if (chunkBuffer.length > 0 && connection.state.isAiSpeaking) {
        // Ensure proper ending punctuation for the final chunk
        if (!sentenceEndPattern.test(chunkBuffer)) {
          chunkBuffer += '.';
        }
        
        if (this.ENABLE_STREAMING_LOGS) {
          console.log(`📤 Streaming final chunk to ElevenLabs (${chunkBuffer.length} chars): "${chunkBuffer}"`);
        }
        
        this.elevenLabsService.sendTextToWebSocket(
          connection.elevenLabsWs, 
          chunkBuffer,
          { tryTriggerGeneration: true }
        );
      }
      
      // Send final flush
      if (connection.state.isAiSpeaking && connection.elevenLabsWs.readyState === WebSocket.OPEN) {
        this.elevenLabsService.sendTextToWebSocket(
          connection.elevenLabsWs,
          " ",
          { flush: true }
        );
        if (this.ENABLE_STREAMING_LOGS) {
          console.log('🔄 Sent final flush to ElevenLabs');
        }
      }
      
    } catch (error) {
      this.logger.error(`Error generating speech: ${error.message}`);
      AiStateHandler.resetAiSpeaking(connection, 'Error in speech generation', this.ENABLE_STATE_LOGS);
    }
  }

  //==============================
  // WEBSOCKET EVENT HANDLERS
  //==============================

  // Handles WebSocket messages from OpenAI
  async handleOpenAiMessage(data: WebSocket.Data, client: WebSocket, state: any) {
    try {
      const response = JSON.parse(data.toString());
      
      // Handle user interruption - stop AI response when user starts speaking
      if (response.type === 'input_audio_buffer.speech_started') {
        this.logger.debug('User speech detected, interrupting AI response');
        
        // Send clear event to stop current audio playback
        if (state.streamSid) {
          const clearEvent = {
            event: 'clear',
            streamSid: state.streamSid
          };
          client.send(JSON.stringify(clearEvent));
          this.logger.debug('Clear event sent to stop audio playback');
        }
        
        // Reset AI speaking state on user interruption
        const clientId = getClientIdFromSocket(client);
        const connection = this.getClientConnection(clientId);
        AiStateHandler.resetAiSpeaking(connection, 'User speech detected');
        
        return;
      }

      if (response.type === 'transcription_session.created' && response.session && response.session.id) {
        state.sessionId = response.session.id;
        this.logger.debug(`Transcription session created: ${state.sessionId}`);
        
        // Apply our custom configuration to the session
        const clientId = getClientIdFromSocket(client);
        const connection = this.getClientConnection(clientId);
        if (connection && connection.openAiWs) {
          this.updateTranscriptionSession(connection.openAiWs, state.sessionId);
          this.logger.debug('Transcription session configuration updated');
        } else {
          this.logger.error('Cannot update transcription session: OpenAI WebSocket not available');
        }
      }

      if (response.type === 'conversation.item.input_audio_transcription.completed' && response.transcript) {
        this.logger.log(`Transcript: "${response.transcript}"`);
        
        const clientId = getClientIdFromSocket(client);
        const connection = this.getClientConnection(clientId);
        
        if (!connection) {
          this.logger.error(`No connection found for client ID: ${clientId}`);
          return;
        }
        
        if (!connection.state) {
          this.logger.error(`Connection state is missing for client ID: ${clientId}`);
          return;
        }
        
        try {
          // Create and store user message
          const userMessage: Message = {
            role: 'user',
            content: response.transcript
          };
          
          // Add to conversation history
          state.conversationHistory.push(userMessage);
          
          // Reset speaking state before generating response
          AiStateHandler.resetAiSpeaking(connection, 'Processing user input');
          
          // Get the call session based on the streamSid
          if (!state.streamSid) {
            this.logger.error('No stream SID found in state');
            return;
          }
          
          const callSession = this.callSessionService.getSessionByStreamSid(state.streamSid);
          if (!callSession) {
            this.logger.error(`No call session found for stream: ${state.streamSid}`);
            return;
          }

          // Log the call details for debugging multiple calls
          this.logger.debug(`Processing transcript for call ${callSession.callSid} [Stream: ${state.streamSid}]`);

          // Generate and send AI response
          await this.convertAndSendSpeech(client, "", state, callSession.callSid);
        } catch (error) {
          this.logger.error(`Error processing transcript: ${error.message}`);
          // Reset speaking state on error
          AiStateHandler.resetAiSpeaking(connection, 'Error during transcript processing');
        }
      }
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
      // Reset speaking state on message handling error
      const clientId = getClientIdFromSocket(client);
      const connection = this.getClientConnection(clientId);
      AiStateHandler.resetAiSpeaking(connection, 'Error in message processing');
    }
  }

  // Update lastActivity for a connection to track active connections
  updateConnectionActivity(clientId: string) {
    const connection = this.clientConnections.get(clientId);
    if (connection) {
      connection.lastActivity = Date.now();
      this.clientConnections.set(clientId, connection);
    }
  }

  // Handles media data from Twilio
  handleMediaMessage(client: WebSocket, data: any) {
    const clientId = getClientIdFromSocket(client);
    const connection = this.clientConnections.get(clientId);
    if (!connection) return;

    // Update the last activity timestamp
    this.updateConnectionActivity(clientId);

    // Safely update state properties
    if (!connection.state) {
      this.logger.error(`Connection state is missing for client ${clientId}`);
      return;
    }
    
    connection.state.latestMediaTimestamp = data.media.timestamp;
    
    if (this.ENABLE_FULL_LOGGING) {
      console.log(`📥 Received media from Twilio, timestamp: ${data.media.timestamp}`);
    }
    
    if (connection.openAiWs && connection.openAiWs.readyState === WebSocket.OPEN) {
      connection.openAiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: data.media.payload
      }));
    }
  }

  // Handles start messages from Twilio
  handleStartMessage(client: WebSocket, data: any) {
    const clientId = getClientIdFromSocket(client);
    const connection = this.clientConnections.get(clientId);
    if (!connection) {
      this.logger.error(`No connection found for client ${clientId} when handling start event`);
      return;
    }

    // Validate data contains required properties
    if (!data.start || !data.start.streamSid) {
      this.logger.error(`Invalid start event data for client ${clientId}`);
      return;
    }

    this.logger.debug(`Stream started [Stream: ${data.start.streamSid}, Call: ${data.start.callSid}]`);
    
    // Ensure connection has a valid state
    if (!connection.state) {
      this.logger.error(`Connection state is missing for client ${clientId}`);
      connection.state = this.initializeClientState();
    }
    
    connection.state.streamSid = data.start.streamSid;
    connection.state.latestMediaTimestamp = 0;
    connection.lastActivity = Date.now();
    
    // Associate the streamSid with the callSid if we have both
    if (data.start.callSid) {
      this.callSessionService.associateStreamWithCall(data.start.streamSid, data.start.callSid);
      
      // Also update the connection's callSid
      connection.callSid = data.start.callSid;
      
      // Re-store the updated connection
      this.clientConnections.set(clientId, connection);
    }
  }

  // Handles mark messages from Twilio
  handleMarkMessage(client: WebSocket) {
    const clientId = getClientIdFromSocket(client);
    const connection = this.clientConnections.get(clientId);
    if (!connection) {
      this.logger.error(`No connection found for client ${clientId} when handling mark event`);
      return;
    }
    
    // Update the last activity timestamp
    this.updateConnectionActivity(clientId);
    
    // No mark queue needed for transcription-only mode
  }

  //==============================
  // TRANSCRIPTION MANAGEMENT
  //==============================

  // Initializes transcription session with OpenAI
  initializeTranscriptionSession(openAiWs: WebSocket) {
    this.logger.debug('Waiting for OpenAI transcription session creation');
  }

  // Updates transcription session with our configuration
  updateTranscriptionSession(openAiWs: WebSocket, sessionId: string) {
    const sessionUpdate = {
      type: "transcription_session.update",
      session: {
        input_audio_format: "g711_ulaw", 
        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe",
          prompt: this.transcriptionPrompt,
          language: "en"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.8,         
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        input_audio_noise_reduction: {
          type: "near_field"
        }
      }
    };

    openAiWs.send(JSON.stringify(sessionUpdate));
    this.logger.debug('Transcription session configuration updated');
  }

  // Utility method for event logging (currently disabled)
  shouldLogEvent(eventType: string): boolean {
    return false; // Disable logging for audio buffer events
  }
}
