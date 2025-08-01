import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../utils/supabase/supabase.module';
import { CallLogsController } from './call-logs.controller';
import { CallLogsService } from './call-logs.service';
import { TranscriptSummarizerService } from './transcript-summarizer.service';

@Module({
  imports: [SupabaseModule],
  controllers: [CallLogsController],
  providers: [CallLogsService, TranscriptSummarizerService],
  exports: [CallLogsService],
})
export class CallLogsModule {}
