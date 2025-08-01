import { Module } from '@nestjs/common';
import { ScrapingController } from './scraping.controller';
import { ScrapingService } from './scraping.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Module({
  controllers: [ScrapingController],
  providers: [ScrapingService, SupabaseService],
  exports: [ScrapingService],
})
export class ScrapingModule {}
