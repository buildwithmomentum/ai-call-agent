import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TwilioController } from './twilio.controller';
import { TwilioService } from './twilio.service';
import { TwilioGateway } from './twilio.gateway';
import { GrokModule } from '../grok/grok.module';
import { ElevenLabsModule } from '../elevenlabs/elevenlabs.module';
import { TwilioPhoneService } from './phone.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { AgentConfigService } from '../agent-config/agent-config.service';
import { ToolsService } from '../tools/tools.service';
import { FunctionsModule } from '../functions/functions.module';
import { FunctionsService } from '../functions/functions.service';
import { CallSessionService } from './call-session.service';

@Module({
  imports: [
    ConfigModule,
    GrokModule,
    ElevenLabsModule,
    FunctionsModule
  ],
  controllers: [TwilioController],
  providers: [
    TwilioService, 
    TwilioGateway, 
    TwilioPhoneService, 
    SupabaseService,
    AgentConfigService,
    ToolsService,
    FunctionsService,
    CallSessionService
  ],
  exports: [TwilioService, TwilioPhoneService, CallSessionService],
})
export class TwilioModule {}
