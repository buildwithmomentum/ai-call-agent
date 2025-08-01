import { Logger } from '@nestjs/common';
import { ClientConnection } from '../types/twilio.types';

export class AiStateHandler {
  private static logger = new Logger('AiStateHandler');

  /**
   * Sets the AI speaking state to true and logs the reason
   * @param connection The client connection
   * @param reason Reason for setting speaking state
   * @param enableLogs Whether to log state changes
   */
  static setAiSpeaking(connection: ClientConnection, value: boolean, reason: string, enableLogs = false) {
    if (!connection) return;
    
    connection.state.isAiSpeaking = value;
    
    if (enableLogs) {
      const streamInfo = connection.state.streamSid || '';
      const callInfo = connection.callSid || '';
      
      this.logger.debug(
        `AI state: ${value ? 'SPEAKING' : 'SILENT'} | ` +
        `Call: ${callInfo} | Stream: ${streamInfo} | Reason: ${reason}`
      );
    }
  }

  /**
   * Resets the AI speaking state to false and logs the reason
   * @param connection The client connection
   * @param reason Reason for resetting speaking state
   * @param enableLogs Whether to log state changes
   */
  static resetAiSpeaking(connection: ClientConnection, reason: string, enableLogs = false) {
    this.setAiSpeaking(connection, false, reason, enableLogs);
  }
} 