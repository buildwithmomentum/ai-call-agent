import { 
  WebSocketGateway, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  WebSocketServer,
  OnGatewayInit
} from '@nestjs/websockets';
import * as WebSocket from 'ws';
import { Server } from 'ws';
import { TwilioService } from './twilio.service';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { ElevenLabsService } from '../elevenlabs/elevenlabs.service';
import { HttpAdapterHost } from '@nestjs/core';
import { TwilioMessageHandler } from './handlers/twilio-message.handler';
import { AiStateHandler } from './handlers/ai-state.handler';
import { ClientConnection } from './types/twilio.types';
import { CallSessionService } from './call-session.service';
import { generateClientId, getClientIdFromSocket } from '../../utils/id-generator.util';

@WebSocketGateway({ path: '/twilio/media-stream' })
@Injectable()
export class TwilioGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;
  
  // Create a manual WebSocket server for handling upgrades
  private manualWsServer: WebSocket.Server;
  private readonly logger = new Logger(TwilioGateway.name);
  private readonly messageHandler: TwilioMessageHandler;

  // Update logging flags
  private readonly ENABLE_AUDIO_LOGS = false;
  private readonly ENABLE_CONNECTION_LOGS = false; // New flag for connection logs
  private readonly ENABLE_STATE_LOGS = false;     // New flag for state change logs

  constructor(
    private readonly twilioService: TwilioService,
    private readonly configService: ConfigService,
    private readonly elevenLabsService: ElevenLabsService,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly callSessionService: CallSessionService,
  ) {
    this.messageHandler = new TwilioMessageHandler(twilioService);
    // Create a manual WebSocket server with noServer: true
    this.manualWsServer = new WebSocket.Server({ noServer: true });
    
    // Set up the connection handler for the manual server
    this.manualWsServer.on('connection', (client, request) => {
      this.logger.debug('Manual WebSocket server connection received');
      
      // Generate a unique client ID using centralized utility
      const clientId = generateClientId();
      
      // Set the client ID directly on the websocket object
      (client as any)._clientId = clientId;
      this.logger.debug(`Setting client ID: ${clientId}`);
      
      // Handle connection setup
      this.handleConnection(client);
      
      // Attach message and close handlers using the handler class
      this.messageHandler.attachHandlers(client, () => {
        this.handleDisconnect(client);
      });
    });
  }
  
  afterInit(server: Server) {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    
    // Handle upgrade requests for this specific WebSocket path
    httpServer.on('upgrade', (request, socket, head) => {
      const url = request.url;
      
      this.logger.debug(`WebSocket upgrade request: ${url}`);
      
      if (url.includes('/twilio/media-stream')) {
        this.logger.debug('Handling /twilio/media-stream upgrade');
        
        // Use the manual WebSocket server to handle the upgrade
        this.manualWsServer.handleUpgrade(request, socket, head, (ws) => {
          this.logger.debug('WebSocket connection upgraded');
          this.manualWsServer.emit('connection', ws, request);
        });
      }
    });
  }

  handleConnection(client: WebSocket) {
    // Initialize client state - we don't have streamSid yet, will be set on 'start' event
    const clientState = this.twilioService.initializeClientState();
    
    this.logger.debug('Connecting to OpenAI Realtime Transcription API');
    
    // Create an OpenAI WebSocket for transcription
    const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription', {
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    // Get the client ID that was set on the client object
    const clientId = getClientIdFromSocket(client);
    this.logger.debug(`Client connected with ID: ${clientId}`);

    // Create connection object, but don't store it yet - we'll set streamSid and store on 'start' event
    const connection: ClientConnection = {
      openAiWs,
      elevenLabsWs: null,
      state: clientState,
      callSid: null, // Will be set when we receive the start event
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    
    // Set up event handlers for the OpenAI WebSocket
    openAiWs.on('open', () => {
      this.logger.debug('Connected to OpenAI Transcription API');
      this.twilioService.initializeTranscriptionSession(openAiWs);
    });
    
    openAiWs.on('error', (error) => {
      this.logger.error(`OpenAI WebSocket error: ${error.message}`);
    });

    openAiWs.on('close', () => {
      this.logger.debug('OpenAI WebSocket connection closed');
    });
    
    openAiWs.on('message', (data) => {
      const conn = this.twilioService.getClientConnection(clientId);
      if (conn) {
        // We need to get the callSid for the streamSid
        const callSession = conn.state.streamSid ? 
          this.callSessionService.getSessionByStreamSid(conn.state.streamSid) : null;
        
        if (callSession) {
          this.twilioService.handleOpenAiMessage(data, client, conn.state);
        } else if (!conn.state.streamSid) {
          // If we don't have a streamSid yet, we're still initializing
          this.twilioService.handleOpenAiMessage(data, client, conn.state);
        } else {
          this.logger.error(`No call session found for stream ${conn.state.streamSid}`);
        }
      } else {
        this.logger.error(`Connection not found for client ${clientId}`);
      }
    });

    // Modify the handleAudioChunk callback
    const handleAudioChunk = (audioBuffer, isFinal, alignmentData) => {
      const conn = this.twilioService.getClientConnection(clientId);
      if (!conn) {
        this.logger.error(`Failed to process audio chunk: Connection not found for ${clientId}`);
        return;
      }
      
      const currentState = conn.state;
      if (!currentState) {
        this.logger.error(`Failed to process audio chunk: State not found for connection ${clientId}`);
        return;
      }
      
      // Skip if this is the final message with no audio
      if (isFinal || !audioBuffer) {
        // Don't log this
        return;
      }
      
      // Check if we have a stream SID
      if (!currentState.streamSid) {
        AiStateHandler.resetAiSpeaking(conn, 'No stream SID available', this.ENABLE_STATE_LOGS);
        return;
      }
      
      // Check if AI should be speaking
      if (!currentState.isAiSpeaking) {
        this.logger.debug('AI not in speaking state, skipping audio chunk');
        return;
      }
      
      // Base64 encode the audio chunk
      const base64Audio = audioBuffer.toString('base64');
      
      // Send to Twilio
      const mediaEvent = {
        event: 'media',
        streamSid: currentState.streamSid,
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
    };
    
    // Create ElevenLabs WebSocket with the handler function
    const elevenLabsWs = this.elevenLabsService.createWebSocketConnection({
      modelId: 'eleven_flash_v2_5',
      outputFormat: 'ulaw_8000',
      optimizeLatency: 4,
      autoMode: true,
      syncAlignment: false,
      textNormalization: 'off',
      inactivityTimeout: 180,
      onAudioChunk: handleAudioChunk,
      onError: (error) => {
        this.logger.error(`ElevenLabs WebSocket error: ${error.message}`);
      },
      onClose: () => {
        this.logger.debug('ElevenLabs WebSocket connection closed');
        const conn = this.twilioService.getClientConnection(clientId);
        AiStateHandler.resetAiSpeaking(conn, 'ElevenLabs connection closed', this.ENABLE_STATE_LOGS);
      }
    });

    // Add an event listener for the 'open' event to ensure we know when the connection is ready
    elevenLabsWs.on('open', () => {
      this.logger.debug(`ElevenLabs WebSocket connection opened for client ${clientId}`);
      
      // Get the connection again and ensure elevenLabsWs is set
      const conn = this.twilioService.getClientConnection(clientId);
      if (conn) {
        conn.elevenLabsWs = elevenLabsWs;
        // Update the connection in the service
        this.twilioService.setClientConnection(clientId, conn, conn.callSid);
        this.logger.debug(`ElevenLabs connection updated for client ${clientId}`);
      }
    });

    // Update the connection with the WebSocket
    connection.elevenLabsWs = elevenLabsWs;
    
    // Now store the connection - we'll set callSid when we get a start event
    this.twilioService.setClientConnection(clientId, connection, null);
    
    // We don't need to set up a separate message handler here as it's already handled by TwilioMessageHandler
    // The client's on('message') handler has been moved to TwilioMessageHandler.attachHandlers
  }
  
  handleDisconnect(client: WebSocket) {
    const clientId = getClientIdFromSocket(client);
    this.logger.debug(`Client disconnecting: ${clientId}`);
    
    const connection = this.twilioService.getClientConnection(clientId);
    
    if (connection) {
      // Get the call session for this connection
      let callSession = null;
      if (connection.state?.streamSid) {
        callSession = this.callSessionService.getSessionByStreamSid(connection.state.streamSid);
      }
      
      // Clear any heartbeat intervals
      if (connection.heartbeatInterval) {
        clearInterval(connection.heartbeatInterval);
        this.logger.debug('Cleared heartbeat interval');
      }
      
      if (connection.openAiWs && connection.openAiWs.readyState === WebSocket.OPEN) {
        this.logger.debug('Closing OpenAI WebSocket connection');
        connection.openAiWs.close();
      }
      
      if (connection.elevenLabsWs && connection.elevenLabsWs.readyState === WebSocket.OPEN) {
        this.logger.debug('Closing ElevenLabs WebSocket connection');
        this.elevenLabsService.closeWebSocketConnection(connection.elevenLabsWs);
      }
      
      // End the call session if we have one
      if (callSession) {
        this.logger.debug(`Ending call ${callSession.callSid}`);
        this.callSessionService.endSession(callSession.callSid);
      }
    } else {
      this.logger.error(`Failed to clean up: Connection not found for ${clientId}`);
    }
    
    this.twilioService.removeClientConnection(clientId);
    this.logger.debug('Client disconnected and resources cleaned up');
  }
}