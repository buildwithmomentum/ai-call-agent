import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { FunctionsService } from '../functions/functions.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Module({
  imports: [
    
  ],
  controllers: [ToolsController],
  providers: [ToolsService, FunctionsService, SupabaseService],
  exports: [ToolsService],
})
export class ToolsModule {}
