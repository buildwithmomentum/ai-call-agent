import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RealtimeModule } from './features/realtime/realtime.module';
import { SupabaseModule } from './utils/supabase/supabase.module';
import { AuthModule } from './features/auth/auth.module';
import { CustomerModule } from './features/customer/customer.module';
import { VoiceagentModule } from './features/voiceagent/voiceagent.module';
import { BusinessModule } from './features/business/business.module';
import { ScrapingModule } from './features/scraping/scraping.module';
import { SourceModule } from './features/source/source.module';
import { TrainingModule } from './features/training/training.module';
import { ConfigModule } from '@nestjs/config';
import { ContextModule } from './features/context/context.module';
import { AgentConfigModule } from './features/agent-config/agent-config.module';
import { FunctionsModule } from './features/functions/functions.module';
import { ToolsModule } from './features/tools/tool.module';
import { CallLogsModule } from './features/call-logs/call-logs.module';
import { AppointmentsModule } from './features/appointments/appointments.module';
import { TwilioOpenaiModule } from './features/twilio-openai/twilio-openai.module';
import { GrokModule } from './features/grok/grok.module';
import { TwilioModule } from './features/twilio/twilio.module';
import { TranscribeAudioModule } from './features/transcribe-audio/transcribe-audio.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    AuthModule,
    CustomerModule,
    VoiceagentModule,
    BusinessModule,
    ScrapingModule,
    SourceModule,
    TrainingModule,
    ContextModule,
    RealtimeModule,
    AgentConfigModule,
    FunctionsModule,
    ToolsModule,
    CallLogsModule,
    AppointmentsModule,
    TwilioModule,
    TwilioOpenaiModule,
    TranscribeAudioModule,
    GrokModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
