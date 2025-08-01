import { Logger } from '@nestjs/common';
import * as WebSocket from 'ws';
import { TwilioService } from '../twilio.service';
import { getClientIdFromSocket } from '../../../utils/id-generator.util';

export class TwilioMessageHandler {
  private readonly logger = new Logger(TwilioMessageHandler.name);

  constructor(
    private readonly twilioService: TwilioService,
  ) {}

  /**
   * Attaches message and close handlers to a WebSocket client
   * @param client The WebSocket client
   * @param closeCallback Optional callback for close event
   */
  attachHandlers(client: WebSocket, closeCallback: () => void) {
    client.on('message', (message) => this.handleMessage(client, message));
    client.on('close', closeCallback);
  }

  /**
   * Handles incoming WebSocket messages
   * @param client The WebSocket client
   * @param message Raw message data
   */
  private handleMessage(client: WebSocket, message: any) {
    try {
      const data = JSON.parse(message.toString());
      
      // Get client ID from the client object (set during connection)
      const clientId = getClientIdFromSocket(client);
      const connection = this.twilioService.getClientConnection(clientId);
      
      if (!connection) {
        this.logger.error(`No connection found for client ${clientId}`);
        return;
      }

      // Only log non-media events to reduce noise
      if (data.event && data.event !== 'media') {
        this.logger.debug(`Event: ${data.event}`);
      }

      // Update the last activity timestamp for this connection
      if (typeof this.twilioService.updateConnectionActivity === 'function') {
        this.twilioService.updateConnectionActivity(clientId);
      }

      switch (data.event) {
        case 'media':
          this.twilioService.handleMediaMessage(client, data);
          break;
        case 'start':
          // Handle the start event to associate the connection with a callSid
          this.twilioService.handleStartMessage(client, data);
          
          // Additional call setup after start event
          if (data.start?.callSid) {
            // Get connection again to ensure it's still valid after handleStartMessage
            const conn = this.twilioService.getClientConnection(clientId);
            if (!conn) {
              this.logger.error(`Connection not found for client ${clientId} when processing start event`);
              return;
            }
            
            // Safely access and update connection properties
            try {
              // Update connection with streamSid and callSid
              conn.state.streamSid = data.start.streamSid;
              conn.callSid = data.start.callSid;
              
              // Re-store the updated connection
              this.twilioService.setClientConnection(clientId, conn, data.start.callSid);
              
              this.logger.debug(`Client ${clientId} assigned to call ${data.start.callSid}`);
              
              // Check if this is a new call that needs initialization
              const callSessionService = (this.twilioService as any).callSessionService;
              if (callSessionService) {
                const existingSession = callSessionService.getSessionByCallSid(data.start.callSid);
                if (!existingSession) {
                  try {
                    // Get phone numbers from the call data
                    const toNumber = data.start.customParameters?.To || 'unknown';
                    const fromNumber = data.start.customParameters?.From || 'unknown';
                    
                    // Initialize the call session with agent configuration
                    this.twilioService.initializeCallSession(data.start.callSid, toNumber, fromNumber).catch(error => {
                      this.logger.error(`Failed to initialize call session: ${error.message}`);
                    });
                  } catch (error) {
                    this.logger.error(`Error during call initialization: ${error.message}`);
                  }
                }
              }
            } catch (error) {
              this.logger.error(`Error updating connection for start event: ${error.message}`);
            }
          }
          break;
        case 'mark':
          this.twilioService.handleMarkMessage(client);
          break;
        case 'stop':
          this.logger.debug(`Stream stopped: ${data.stop?.streamSid || 'unknown'}`);
          break;
        default:
          if (data.event !== 'connected') { // Ignore common events
            this.logger.debug(`Unknown event: ${data.event}`);
          }
      }
    } catch (error) {
      this.logger.error(`Message handling error: ${error.message}`);
    }
  }
} 