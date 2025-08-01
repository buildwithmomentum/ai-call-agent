import { TTSConfigDto } from '../dto';
import * as stream from 'stream';
import * as WebSocket from 'ws';

export interface TTSServiceInterface {
  streamTextToSpeech(
    text: string,
    audioChunkHandler: (audioBuffer: Buffer) => void,
    options?: Partial<TTSConfigDto>
  ): Promise<stream.Readable>;
  
  convertTextToSpeech(
    text: string,
    options?: Partial<TTSConfigDto>
  ): Promise<Buffer>;
  
  createWebSocketConnection(
    options?: {
      voiceId?: string;
      modelId?: string;
      outputFormat?: string;
      optimizeLatency?: number;
      autoMode?: boolean;
      inactivityTimeout?: number;
      syncAlignment?: boolean;
      textNormalization?: 'auto' | 'on' | 'off';
      enableSsmlParsing?: boolean;
      onAudioChunk?: (audioBuffer: Buffer, isFinal: boolean, alignment?: any) => void;
      onError?: (error: Error) => void;
      onClose?: () => void;
    }
  ): WebSocket;
  
  sendTextToWebSocket(
    ws: WebSocket, 
    text: string, 
    options?: {
      flush?: boolean;
      tryTriggerGeneration?: boolean;
    }
  ): void;
  
  sendCloseMessage(
    ws: WebSocket
  ): void;
  
  closeWebSocketConnection(
    ws: WebSocket
  ): void;
  
  updateConfig(newConfig: Partial<TTSConfigDto>): void;
  
  getCurrentConfig(): TTSConfigDto;
  
  updateConfigFromDatabase(userId?: string, configId?: string): Promise<void>;
} 