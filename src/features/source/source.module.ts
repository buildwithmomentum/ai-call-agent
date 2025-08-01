import { Module } from '@nestjs/common';
import { SourceController } from './source.controller';
import { SourceService } from './source.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Module({
  controllers: [SourceController],
  providers: [SourceService, SupabaseService],
  exports: [SourceService],
})
export class SourceModule {}
