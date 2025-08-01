import { Controller, Post, Body, Header, StreamableFile, Get } from '@nestjs/common';
import { ElevenLabsService } from './elevenlabs.service';
import { TextToSpeechDto } from './dto/text-to-speech.dto';

@Controller('elevenlabs')
export class ElevenLabsController {
  constructor(private readonly elevenLabsService: ElevenLabsService) {}

  @Post('text-to-speech')
  @Header('Content-Type', 'audio/mpeg')
  async convertTextToSpeech(@Body() dto: TextToSpeechDto): Promise<StreamableFile> {
    const audioBuffer = await this.elevenLabsService.convertTextToSpeech(dto);
    return new StreamableFile(audioBuffer);
  }

  @Get('voices')
  async getVoices() {
    return await this.elevenLabsService.getVoices();
  }
} 