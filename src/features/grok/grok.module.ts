import { Module } from '@nestjs/common';
import { GrokController } from './grok.controller';
import { GrokService } from './grok.service';
import { ConfigModule } from '@nestjs/config';
import { FunctionExecutorService } from './function-executor.service';
import { FunctionsModule } from '../functions/functions.module';
import { CallSessionService } from '../twilio/call-session.service';
import { TwilioPhoneService } from '../twilio/phone.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Module({
  imports: [
    ConfigModule,
    FunctionsModule
  ],
  controllers: [GrokController],
  providers: [
    GrokService,
    FunctionExecutorService,
    CallSessionService,
    TwilioPhoneService,
    SupabaseService
  ],
  exports: [GrokService, FunctionExecutorService],
})
export class GrokModule {}