import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';
import * as dotenv from 'dotenv';
import { AgentConfigService } from '../agent-config/agent-config.service';
import { TwilioPhoneService } from './twilio-phone.service';
import { TwilioOpenAIConfig, ModelConfig, DEFAULT_MODEL_CONFIG } from './types/twilio-openai.types';
import { ToolsService } from '../tools/tools.service';
import { FunctionsService } from '../functions/functions.service';
import { FunctionExecutorService, FunctionResult } from './function-executor.service';
import { CallSessionService } from './call-session.service';
import { CallLogsService } from '../call-logs/call-logs.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { CallHistoryService } from './call-history.service';

// Load environment variables directly from .env file
dotenv.config();

@Injectable()
export class TwilioOpenaiService implements OnModuleInit {
  private readonly logger = new Logger(TwilioOpenaiService.name);
  private readonly LOG_EVENT_TYPES = [
    'error'  // Only log errors, remove other event types
  ];
  private readonly SHOW_TIMING_MATH = false;
  private apiKey: string;
  private config: ModelConfig = DEFAULT_MODEL_CONFIG;
  private functionData: any[] = [];

  constructor(
    private configService: ConfigService,
    private agentConfigService: AgentConfigService,
    private twilioPhoneService: TwilioPhoneService,
    private readonly toolsService: ToolsService,
    private readonly functionsService: FunctionsService,
    private readonly functionExecutor: FunctionExecutorService,
    private readonly callSessionService: CallSessionService,
    private readonly callLogsService: CallLogsService,
    private readonly supabaseService: SupabaseService,
    private readonly callHistoryService: CallHistoryService,
  ) {
    this.apiKey = process.env.OPENAI_API_KEY || this.configService.get<string>('OPENAI_API_KEY');
    
    if (!this.apiKey) {
      this.logger.error('Missing OpenAI API key. Please set it in the .env file or environment variables.');
      throw new Error('Missing OpenAI API key');
    }
  }

  async setVoiceAgentId(phoneNumber: string) {
    const id = await this.twilioPhoneService.getVoiceAgentIdByPhoneNumber(phoneNumber);
    if (!id) {
      this.logger.error(`No voice agent found for phone number ${phoneNumber}`);
      throw new Error(`No voice agent configured for phone number ${phoneNumber}`);
    }
    await this.updateConfig(id);
  }

  async initializeCallSession(callSid: string, phoneNumber: string, fromNumber: string): Promise<string> {
    const agentId = await this.twilioPhoneService.getVoiceAgentIdByPhoneNumber(phoneNumber);
    if (!agentId) {
      throw new Error(`No voice agent configured for phone number ${phoneNumber}`);
    }
    
    this.callSessionService.createSession(callSid, agentId, fromNumber, phoneNumber);
    await this.updateConfig(agentId);
    return agentId;
  }

  private async updateConfig(agentId: string) {
    try {
      const [agentConfig, tools, functions] = await Promise.all([
        this.agentConfigService.getCachedAgentConfig(agentId),
        this.toolsService.getTools(agentId),
        this.functionsService.getFunctionsByAssistantId(agentId)
      ]);

      this.functionData = functions || [];
      const modelSettings = agentConfig?.voiceAgent?.private_settings?.model;

      if (!modelSettings) {
        throw new Error('No model configuration found');
      }

      this.config = {
        model: modelSettings.model || this.config.model,
        voice: modelSettings.voice || this.config.voice,
        temperature: modelSettings.temperature || this.config.temperature,
        SYSTEM_MESSAGE: modelSettings.SYSTEM_MESSAGE,
        tools: tools
      };

      if (!this.config.SYSTEM_MESSAGE) {
        throw new Error('No system message found in config');
      }
    } catch (error) {
      this.logger.error('Failed to get configuration from agent config', error);
      throw error;
    }
  }

  async onModuleInit() {
    this.logger.log('TwilioOpenaiService initialized');
  }

  getWelcomeMessage() {
    return { message: 'Twilio Media Stream Server is running!' };
  }

  getTwimlResponse(host: string): string {
    this.logger.log(`Generating TwiML response for host: ${host}`);
    
    const wsUrl = `wss://${host}/twilio-openai/media-stream`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="Polly.Amy-Neural">One moment, connecting you with our AI assistant.</Say>
                <Connect>
                    <Stream url="${wsUrl}" />
                </Connect>
            </Response>`;
  }

  async handleCallEnding(streamSid: string) {
    const session = this.callSessionService.getSessionByStreamSid(streamSid);
    if (!session) return;

    // Set end time in session
    session.endTime = new Date();

    // Prepare and send call log data
    const callLogData = this.callSessionService.prepareFinalCallData(session.callSid);
    if (callLogData) {
      try {
        await this.callLogsService.create(callLogData);
        this.logger.log(`Call log created for CallSid: ${session.callSid}`);
      } catch (error) {
        this.logger.error(`Failed to create call log: ${error.message}`);
      }
    }

    // End the session
    this.callSessionService.endSession(session.callSid);
  }

  handleWebSocketConnection(client: WebSocket, request: any) {
    // Connection-specific state
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;
    let greetingSent = false; // Flag to track if greeting has been sent
    let callSession = null; // Store reference to the call session

    // Create OpenAI WebSocket connection with API key
    this.logger.log('Connecting to OpenAI Realtime API...');
    const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    // Control initial session with OpenAI
    const initializeSession = () => {
      const sessionUpdate = {
        type: 'session.update',
        session: {
          turn_detection: { type: 'server_vad' },
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          voice: this.config.voice,
          instructions: this.config.SYSTEM_MESSAGE,
          modalities: ["text", "audio"],
          temperature: this.config.temperature,
          input_audio_transcription: {
            model: 'whisper-1',
          },
          tools: this.config.tools,
          tool_choice: 'auto', 
        }
      };

      // this.logger.log('Session Update Configuration:', JSON.stringify(sessionUpdate, null, 2));
      openAiWs.send(JSON.stringify(sessionUpdate));
      
      // Send a greeting prompt after session initialization, but only if we haven't sent one yet
      if (!greetingSent && callSession) {
        // Send the greeting with context about previous calls if available
        this.sendGreetingWithContext(openAiWs, callSession);
        greetingSent = true;
      }
    };

    // New method to send greeting with context from previous calls
    const sendGreetingWithContext = async (ws, session) => {
      try {
        // Get the caller number from the session
        const callerNumber = session.fromNumber;
        const agentId = session.agentId;
        
        // Get contextual greeting from CallHistoryService
        const greetingPrompt = await this.callHistoryService.buildContextualGreeting(agentId, callerNumber);
        
        // Create the greeting event
        const greetingEvent = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: greetingPrompt
            }]
          }
        };
        
        ws.send(JSON.stringify(greetingEvent));
        
        // Request a response for the greeting
        const responseEvent = {
          type: "response.create"
        };
        
        ws.send(JSON.stringify(responseEvent));
        this.logger.log('Sent contextualized greeting prompt to OpenAI');
      } catch (error) {
        this.logger.error(`Error sending greeting with context: ${error.message}`);
        
        // Fallback to basic greeting if there was an error
        const basicGreetingEvent = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: "Introduce yourself by saying your name and greeting the customer appropriately."
            }]
          }
        };
        
        ws.send(JSON.stringify(basicGreetingEvent));
        ws.send(JSON.stringify({ type: "response.create" }));
      }
    };

    // Handle interruption when the caller's speech starts
    const handleSpeechStartedEvent = () => {
      if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
        const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;

        if (lastAssistantItem) {
          const truncateEvent = {
            type: 'conversation.item.truncate',
            item_id: lastAssistantItem,
            content_index: 0,
            audio_end_ms: elapsedTime
          };
          openAiWs.send(JSON.stringify(truncateEvent));
        }

        client.send(JSON.stringify({
          event: 'clear',
          streamSid: streamSid
        }));

        // Reset
        markQueue = [];
        lastAssistantItem = null;
        responseStartTimestampTwilio = null;
      }
    };

    // Send mark messages to Media Streams so we know if and when AI response playback is finished
    const sendMark = (connection, streamSid) => {
      if (streamSid) {
        const markEvent = {
          event: 'mark',
          streamSid: streamSid,
          mark: { name: 'responsePart' }
        };
        connection.send(JSON.stringify(markEvent));
        markQueue.push('responsePart');
      }
    };

    // Open event for OpenAI WebSocket
    openAiWs.on('open', () => {
      this.logger.log('Connected to the OpenAI Realtime API');
      setTimeout(initializeSession, 100);
    });

    // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
    openAiWs.on('message', async (data) => {
      try {
        const response = JSON.parse(data.toString());

        // Handle user audio transcripts
        if (response.type === 'conversation.item.input_audio_transcription.completed') {
          this.callSessionService.handleUserTranscript(streamSid, response);
        }

        // Handle assistant audio transcripts
        if (response.type === 'response.audio_transcript.done') {
          this.callSessionService.handleAudioTranscript(streamSid, response);
        }

        // Handle function calls from response.done event
        if (response.type === 'response.done' && 
            response.response?.output && 
            response.response.output.length > 0 &&
            response.response.output[0]?.type === 'function_call') {
          
          const session = this.callSessionService.getSessionByStreamSid(streamSid);
          if (!session) {
            this.logger.error('No active session found for stream:', streamSid);
            return;
          }

          const functionCallItem = response.response.output[0];
          const result: FunctionResult = await this.functionExecutor.executeFunction(
            functionCallItem, 
            session.agentId,
            this.functionData,
            streamSid
          );
          
          let contextInfo: string;
          if (result.status === "error") {
            contextInfo = `Error: ${result.error}`;
          } else if (result.status === "success" && result.data && result.data[0]) {
            contextInfo = result.data[0].context;
          } else {
            contextInfo = "No relevant information found.";
          }
          
          const functionResult = {
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: functionCallItem.call_id,
              output: JSON.stringify({ information: contextInfo })
            }
          };
          
          openAiWs.send(JSON.stringify(functionResult));
          
          // Always request a response after a function call, including end_call
          // This ensures the AI can say goodbye before the call ends
          setTimeout(() => {
            openAiWs.send(JSON.stringify({ type: "response.create" }));
          }, 100);
        }

        if (response.type === 'response.audio.delta' && response.delta) {
          const audioDelta = {
            event: 'media',
            streamSid: streamSid,
            media: { payload: response.delta }
          };
          
          try {
            client.send(JSON.stringify(audioDelta));
          } catch (error) {
            this.logger.error('Error sending audio delta to client:', error);
          }

          // First delta from a new response starts the elapsed time counter
          if (!responseStartTimestampTwilio) {
            responseStartTimestampTwilio = latestMediaTimestamp;
          }

          if (response.item_id) {
            lastAssistantItem = response.item_id;
          }
          
          sendMark(client, streamSid);
        }

        if (response.type === 'input_audio_buffer.speech_started') {
          handleSpeechStartedEvent();
        }

      } catch (error) {
        this.logger.error('Error processing OpenAI message:', error);
      }
    });

    // Handle incoming messages from Twilio
    client.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.event) {
          case 'media':
            latestMediaTimestamp = data.media.timestamp;
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              };
              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;
          case 'start':
            streamSid = data.start.streamSid;
            // Get the CallSid from the start event
            const callSid = data.start.callSid;
            this.logger.log('Incoming stream has started', streamSid);
            
            // Associate stream with call session
            this.callSessionService.associateStreamWithCall(streamSid, callSid);
            
            // Get the session for this call
            callSession = this.callSessionService.getSessionByCallSid(callSid);
            
            // Reset start and media timestamp on a new stream
            responseStartTimestampTwilio = null; 
            latestMediaTimestamp = 0;
            break;
          case 'mark':
            if (markQueue.length > 0) {
              markQueue.shift();
            }
            break;
          case 'stop':
            this.logger.log('Received stop event');
            break;
          default:
            this.logger.log(`Received event: ${data.event}`);
            break;
        }
      } catch (error) {
        this.logger.error('Error parsing message:', error);
      }
    });

    // Handle connection close
    client.on('close', async (code, reason) => {
      this.logger.log(`Client disconnected. Code: ${code}`);
      if (streamSid) {
        await this.handleCallEnding(streamSid);
      }
      if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
    });

    // Handle WebSocket close and errors
    openAiWs.on('close', (code) => {
      this.logger.log(`Disconnected from the OpenAI Realtime API. Code: ${code}`);
    });

    openAiWs.on('error', (error) => {
      this.logger.error('Error in the OpenAI WebSocket:', error);
    });
  }

  // Add the sendGreetingWithContext method to the class
  async sendGreetingWithContext(ws: WebSocket, session: any) {
    try {
      // Get the caller number from the session
      const callerNumber = session.fromNumber;
      const agentId = session.agentId;
      
      // Get contextual greeting from CallHistoryService
      const greetingPrompt = await this.callHistoryService.buildContextualGreeting(agentId, callerNumber);
      
      // Create the greeting event
      const greetingEvent = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{
            type: "input_text",
            text: greetingPrompt
          }]
        }
      };
      
      ws.send(JSON.stringify(greetingEvent));
      
      // Request a response for the greeting
      const responseEvent = {
        type: "response.create"
      };
      
      ws.send(JSON.stringify(responseEvent));
      this.logger.log('Sent contextualized greeting prompt to OpenAI');
    } catch (error) {
      this.logger.error(`Error sending greeting with context: ${error.message}`);
      
      // Fallback to basic greeting if there was an error
      const basicGreetingEvent = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{
            type: "input_text",
            text: "Introduce yourself by saying your name and greeting the customer appropriately."
          }]
        }
      };
      
      ws.send(JSON.stringify(basicGreetingEvent));
      ws.send(JSON.stringify({ type: "response.create" }));
    }
  }
}