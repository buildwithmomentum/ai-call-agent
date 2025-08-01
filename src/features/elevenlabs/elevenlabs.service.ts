import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as stream from 'stream';
import * as dotenv from 'dotenv';
import { TTSConfigDto, TTSRequestDto } from './dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as https from 'https';
import * as WebSocket from 'ws';
import { TextToSpeechDto } from './dto/text-to-speech.dto';

// Load environment variables directly from .env file
dotenv.config();

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  
  // Get only the API key from env using dotenv
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.elevenlabs.io/v1';
  private readonly defaultVoiceId = 'cgSgspJ2msm6clMCkdW9'; //Jessica
  // "accent": "american",
  // "description": "expressive",
  // "age": "young",
  // "gender": "female",
  // "use_case": "conversational"
  
  // Default configuration - all will be configurable later
  private ttsConfig: TTSConfigDto = {
    voiceId: 'cgSgspJ2msm6clMCkdW9', //Jessica
    modelId: 'eleven_flash_v2_5',
    optimizeLatency: 4,
    outputFormat: 'ulaw_8000',
    textNormalization: 'off',
    stability: 0.5,
    style: 0.0
  };

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    if (!this.apiKey) {
      this.logger.error('ElevenLabs API key is not defined in environment variables');
      throw new Error('Missing ElevenLabs API key. Please set ELEVENLABS_API_KEY in the .env file.');
    }
  }

  // Method to update configuration from database (to be implemented later)
  async updateConfigFromDatabase(userId?: string, configId?: string): Promise<void> {
    this.logger.log(`Will fetch TTS config for user ${userId || 'default'}, config ${configId || 'default'}`);
  }

  // Getter for current config
  getCurrentConfig(): TTSConfigDto {
    return { ...this.ttsConfig };
  }

  // Method to update config programmatically
  updateConfig(newConfig: Partial<TTSConfigDto>): void {
    this.ttsConfig = { ...this.ttsConfig, ...newConfig };
    this.logger.log('TTS configuration updated');
  }

  /**
   * Stream text to speech using ElevenLabs API with Flash v2.5
   * @param text The text to convert to speech
   * @param onChunk Callback function to receive each audio chunk
   * @param options Configuration options
   * @returns Promise that resolves when streaming is complete
   */
  async streamTextToSpeech(
    text: string, 
    onChunk: (chunk: Buffer) => void,
    options: {
      voiceId?: string;
      outputFormat?: string;
      model?: string;
      optimizeLatency?: number;
    } = {}
  ): Promise<void> {
    const voiceId = options.voiceId || this.ttsConfig.voiceId || this.defaultVoiceId;
    const outputFormat = options.outputFormat || this.ttsConfig.outputFormat || 'ulaw_8000';
    const model = options.model || this.ttsConfig.modelId || 'eleven_flash_v2_5';
    const optimizeLatency = options.optimizeLatency || this.ttsConfig.optimizeLatency || 4;
    
    this.logger.log(`Streaming TTS using model: ${model}, voice: ${voiceId}, format: ${outputFormat}`);
    
    try {
      const url = `${this.baseUrl}/text-to-speech/${voiceId}/stream`;
      
      // Build query parameters correctly
      const params = new URLSearchParams();
      params.append('output_format', outputFormat);
      if (optimizeLatency !== undefined) {
        params.append('optimize_streaming_latency', optimizeLatency.toString());
      }
      
      const fullUrl = `${url}?${params.toString()}`;
      this.logger.log(`Streaming request to: ${fullUrl}`);
      
      const response = await axios({
        method: 'POST',
        url: fullUrl,
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        data: {
          text,
          model_id: model,
          voice_settings: {
            stability: this.ttsConfig.stability || 0.5,
            similarity_boost: 0.75,
            style: this.ttsConfig.style || 0.0,
          }
        },
        responseType: 'stream',
        httpAgent: new https.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true }),
      });
      
      // Process the stream
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          try {
            onChunk(chunk);
          } catch (error) {
            this.logger.error('Error processing audio chunk', error);
          }
        });
        
        response.data.on('end', () => {
          this.logger.log('Streaming completed');
          resolve();
        });
        
        response.data.on('error', (error) => {
          this.logger.error('Stream error', error);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error(`Streaming error: ${error.message}`);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data || 'Text to speech conversion failed';
        const statusCode = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
        this.logger.error(`Response status: ${statusCode}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response?.data)}`);
        throw new HttpException(errorMessage, statusCode);
      }
      throw new Error(`Failed to stream text to speech: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using ElevenLabs API (non-streaming)
   * @param dto The text to convert to speech
   * @returns Promise with the audio buffer
   */
  async convertTextToSpeech(dto: TextToSpeechDto): Promise<Buffer> {
    const url = `${this.baseUrl}/text-to-speech/${dto.voiceId}`;
    
    try {
      const response = await axios({
        method: 'POST',
        url: url,
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        params: {
          output_format: dto.outputFormat,
        },
        data: {
          text: dto.text,
          model_id: dto.modelId,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new HttpException(
          error.response?.data || 'Text to speech conversion failed',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw error;
    }
  }

  /**
   * Create and configure a WebSocket connection to ElevenLabs stream-input API
   * @param options Configuration options
   * @returns WebSocket connection
   */
  createWebSocketConnection(
    options: {
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
    } = {}
  ): WebSocket {
    const voiceId = options.voiceId || this.ttsConfig.voiceId || this.defaultVoiceId;
    const modelId = options.modelId || this.ttsConfig.modelId || 'eleven_flash_v2_5';
    const outputFormat = options.outputFormat || this.ttsConfig.outputFormat || 'ulaw_8000';
    
    // Set auto_mode to true by default since we're sending complete sentences
    const autoMode = options.autoMode !== undefined ? options.autoMode : true;
    
    // Build the WebSocket URL with query parameters
    let wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}`;
    
    if (outputFormat) {
      wsUrl += `&output_format=${outputFormat}`;
    }
    
    if (options.optimizeLatency !== undefined) {
      wsUrl += `&optimize_streaming_latency=${options.optimizeLatency}`;
    }
    
    wsUrl += `&auto_mode=${autoMode}`;
    
    if (options.syncAlignment !== undefined) {
      wsUrl += `&sync_alignment=${options.syncAlignment}`;
    }
    
    if (options.inactivityTimeout !== undefined) {
      wsUrl += `&inactivity_timeout=${options.inactivityTimeout}`;
    } else {
      wsUrl += `&inactivity_timeout=180`; // Set to maximum allowed value
    }
    
    if (options.textNormalization) {
      wsUrl += `&apply_text_normalization=${options.textNormalization}`;
    }
    
    if (options.enableSsmlParsing !== undefined) {
      wsUrl += `&enable_ssml_parsing=${options.enableSsmlParsing}`;
    }
    
    this.logger.log(`Creating ElevenLabs WebSocket connection to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      this.logger.log('✅ Connected to ElevenLabs WebSocket API');
      
      // Send initial handshake message with blank space and API key
      const initialMessage = {
        text: " ", // Required blank space for initialization
        voice_settings: {
          stability: this.ttsConfig.stability || 0.5,
          similarity_boost: 0.8,
          speed: 1  // Added speed parameter
        },
        "xi-api-key": this.apiKey
      };
      
      ws.send(JSON.stringify(initialMessage));
      this.logger.log('Sent initial handshake message');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Check if this is the final message
        if (message.isFinal === true) {
          this.logger.log('Received final message from ElevenLabs');
          if (options.onAudioChunk) {
            options.onAudioChunk(null, true);
          }
          return;
        }
        
        // Check if this is an audio message
        if (message.audio) {
          // Decode base64 audio data
          const audioBuffer = Buffer.from(message.audio, 'base64');
          
          // Extract alignment data if present
          const alignment = message.alignment || null;
          const normalizedAlignment = message.normalizedAlignment || null;
          
          // Pass to callback if provided
          if (options.onAudioChunk) {
            options.onAudioChunk(audioBuffer, false, { 
              alignment, 
              normalizedAlignment 
            });
          }
        } else {
          console.log('⚠️ Received message with no audio data:', JSON.stringify(message).substring(0, 100));
        }
      } catch (error) {
        this.logger.error(`Error processing WebSocket message: ${error.message}`);
        console.error('Raw message data:', data.toString().substring(0, 100) + '...');
      }
    });
    
    ws.on('error', (error) => {
      this.logger.error(`ElevenLabs WebSocket error: ${error.message}`);
      if (options.onError) {
        options.onError(error);
      }
    });
    
    ws.on('close', () => {
      this.logger.log('ElevenLabs WebSocket connection closed');
      if (options.onClose) {
        options.onClose();
      }
    });
    
    return ws;
  }
  
  /**
   * Send text to an established WebSocket connection
   * @param ws WebSocket connection
   * @param text Text to convert to speech
   * @param options Additional options for sending text
   */
  sendTextToWebSocket(
    ws: WebSocket, 
    text: string, 
    options: {
      flush?: boolean;
      tryTriggerGeneration?: boolean;
    } = {}
  ): void {
    if (ws.readyState !== WebSocket.OPEN) {
      this.logger.error('Cannot send text: WebSocket is not open');
      return;
    }
    
    // Clean up the text - remove any leading/trailing whitespace
    // and ensure it ends with a space as ElevenLabs recommends
    const trimmedText = text.trim();
    const formattedText = trimmedText.endsWith(' ') ? trimmedText : trimmedText + ' ';
    
    // Only proceed if we have meaningful text (or it's a flush command)
    if (formattedText.length === 0 && !options.flush) {
      return;
    }
    
    const message: any = {
      text: formattedText
    };
    
    // Only add flush if specifically requested
    if (options.flush === true) {
      message.flush = true;
    }
    
    // Add tryTriggerGeneration if specified and we have substantial text
    // This helps avoid quality issues with very short fragments
    if (options.tryTriggerGeneration === true && formattedText.length > 30) {
      message.try_trigger_generation = true;
    }
    
    ws.send(JSON.stringify(message));
    
    // Only log meaningful text (not heartbeats or flush commands)
    if (trimmedText.length > 1) {
      this.logger.log(`Sent text to ElevenLabs WebSocket: "${formattedText}"`);
    }
  }
  
  /**
   * Send an empty message to close the connection gracefully
   * @param ws WebSocket connection
   */
  sendCloseMessage(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN) {
      const closeMessage = {
        text: ""
      };
      ws.send(JSON.stringify(closeMessage));
      this.logger.log('Sent empty text message to initiate close');
    }
  }
  
  /**
   * Close the WebSocket connection
   * @param ws WebSocket connection
   */
  closeWebSocketConnection(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      // Close the connection directly without sending empty message
      ws.close();
      this.logger.log('Closed ElevenLabs WebSocket connection');
    }
  }

  async getVoices() {
    const url = `${this.baseUrl}/voices`;
    
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json',
            }
        });

        return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Failed to fetch voices: ${error.message}`);
        this.logger.error(`Response status: ${error.response?.status}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response?.data)}`);
        throw new HttpException(
          error.response?.data || 'Failed to fetch voices',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      this.logger.error(`Unexpected error during voice fetching: ${error.message}`);
      throw new Error(`Failed to fetch voices: ${error.message}`);
    }
  }
}