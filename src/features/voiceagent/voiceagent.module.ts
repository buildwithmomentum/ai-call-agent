import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoiceagentController } from './voiceagent.controller';
import { VoiceagentService } from './voiceagent.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CustomerModule } from '../customer/customer.module'; // added import

@Module({
  imports: [
    ConfigModule,
    CustomerModule, // added CustomerModule
  ],
  controllers: [VoiceagentController],
  providers: [
    VoiceagentService,
    SupabaseService,
    SupabaseAuthGuard,
  ],
  exports: [VoiceagentService],
})
export class VoiceagentModule {}
