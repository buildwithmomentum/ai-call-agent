import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { ProcessFileService } from './process-file.service';
import { CreateEmbeddingsService } from './create-embeddings.service';
import { HandleStorageService } from './handle-storage.service';
import { ProcessWebsiteService } from './process-website.service';
import { SummaryService } from './summary.service';
import { BusinessService } from '../../features/business/business.service';
import { TranscribeAudioModule } from '../transcribe-audio/transcribe-audio.module';

@Module({
  controllers: [TrainingController],
  providers: [
    TrainingService,
    SupabaseService,
    ProcessFileService,
    CreateEmbeddingsService,
    HandleStorageService,
    ProcessWebsiteService,
    SummaryService,
    BusinessService,
  ],
  exports: [TrainingService],
  imports: [TranscribeAudioModule],
})
export class TrainingModule {}
