import { Module } from '@nestjs/common';
import { ContextService } from './context.service';
import { ContextController } from './context.controller';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Module({
  providers: [ContextService, SupabaseService],
  controllers: [ContextController],
})
export class ContextModule {}
