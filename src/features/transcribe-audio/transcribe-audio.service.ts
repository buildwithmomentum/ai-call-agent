import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ElevenLabsClient } from 'elevenlabs';

dotenv.config();

@Injectable()
export class TranscribeAudioService {
  private readonly openai: OpenAI;
  private readonly elevenLabs: ElevenLabsClient;
  private readonly logger = new Logger(TranscribeAudioService.name);

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.elevenLabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY || this.configService.get<string>('ELEVENLABS_API_KEY'),
    });
  }

  /**
   * Transcribe an audio file using OpenAI
   * @param filePath Path to the audio file
   * @returns The transcribed text
   */
  async transcribeWithOpenAI(filePath: string): Promise<string> {
    try {
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'gpt-4o-mini-transcribe',
        response_format: 'text',
      });
      
      return response;
    } catch (error) {
      this.logger.error(`Error transcribing audio: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Transcribe an audio file using ElevenLabs
   * @param filePath Path to the audio file
   * @returns The transcribed text
   */
  async transcribeWithElevenLabs(filePath: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      const audioBlob = new Blob([buffer], { type: "audio/mp3" });

      const transcription = await this.elevenLabs.speechToText.convert({
        file: audioBlob,
        model_id: "scribe_v1",
        tag_audio_events: true,
        language_code: "eng",
        diarize: true,
      });

      return transcription.text;
    } catch (error) {
      this.logger.error(`Error transcribing with ElevenLabs: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Transcribe an audio file using the preferred service
   * @param filePath Path to the audio file
   * @param service 'openai' or 'elevenlabs'
   * @returns The transcribed text
   */
  async transcribeAudio(filePath: string, service: 'openai' | 'elevenlabs' = 'openai'): Promise<string> {
    const result = service === 'openai' 
      ? await this.transcribeWithOpenAI(filePath)
      : await this.transcribeWithElevenLabs(filePath);

    return result;
  }
}
