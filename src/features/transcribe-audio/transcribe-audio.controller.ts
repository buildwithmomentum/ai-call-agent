import { Controller, Post, UploadedFile, UseInterceptors, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TranscribeAudioService } from './transcribe-audio.service';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';

@Controller('transcribe')
export class TranscribeAudioController {
  constructor(private readonly transcribeService: TranscribeAudioService) {}

  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
        },
      }),
    }),
  )
  async transcribeAudio(
    @UploadedFile() file: Express.Multer.File,
    @Query('service') service: 'openai' | 'elevenlabs' = 'openai'
  ) {
    try {
      const transcription = await this.transcribeService.transcribeAudio(
        file.path,
        service
      );
      
      // Delete the file after transcription
      await fs.unlink(file.path);
      
      return { 
        success: true, 
        transcription,
        service 
      };
    } catch (error) {
      // Attempt to delete the file even if transcription fails
      try {
        await fs.unlink(file.path);
      } catch (deleteError) {
        console.error('Failed to delete audio file:', deleteError);
      }
      
      return { 
        success: false, 
        error: error.message,
        service 
      };
    }
  }
}
