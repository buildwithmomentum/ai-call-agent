import { Module } from '@nestjs/common';
import { TranscribeAudioService } from './transcribe-audio.service';
import { TranscribeAudioController } from './transcribe-audio.controller';

@Module({
  providers: [TranscribeAudioService],
  exports: [TranscribeAudioService],
  controllers: [TranscribeAudioController],
})
export class TranscribeAudioModule {}
