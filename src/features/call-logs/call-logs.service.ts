import { Injectable } from '@nestjs/common';
import { CreateCallLogDto } from './dto/create-call-log.dto';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { TranscriptSummarizerService } from './transcript-summarizer.service';

@Injectable()
export class CallLogsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly transcriptSummarizerService: TranscriptSummarizerService
  ) {}

  async create(createCallLogDto: CreateCallLogDto): Promise<any> {
    // If there's a transcript, summarize it first
    let summary = null;
    if (createCallLogDto.transcript && Array.isArray(createCallLogDto.transcript)) {
      summary = await this.transcriptSummarizerService.summarizeTranscript(createCallLogDto.transcript);
    }

    // Add summary to the call log
    const callLogWithSummary = {
      ...createCallLogDto,
      summary: summary ? summary.summary : null,
      summary_metadata: summary ? summary.metadata : null
    };

    const { data, error } = await this.supabaseService.getClient()
      .from('call_logs')
      .insert([callLogWithSummary]);

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
}
