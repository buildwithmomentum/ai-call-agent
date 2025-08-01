import { Module } from '@nestjs/common';
import { TwilioOpenaiController } from './twilio-openai.controller';
import { TwilioOpenaiService } from './twilio-openai.service';
import { ConfigModule } from '@nestjs/config';
import * as WebSocket from 'ws';
import { Logger } from '@nestjs/common';
import { AgentConfigModule } from '../agent-config/agent-config.module';
import { TwilioPhoneService } from './twilio-phone.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { ToolsModule } from '../tools/tool.module';
import { FunctionsModule } from '../functions/functions.module';
import { FunctionExecutorService } from './function-executor.service';
import { CallSessionService } from './call-session.service';
import { CallLogsModule } from '../call-logs/call-logs.module';
import { CallHistoryService } from './call-history.service';

@Module({
  imports: [
    ConfigModule,
    AgentConfigModule,
    ToolsModule,
    FunctionsModule,
    CallLogsModule,
  ],
  controllers: [TwilioOpenaiController],
  providers: [
    TwilioOpenaiService,
    TwilioPhoneService,
    SupabaseService,
    FunctionExecutorService,
    CallSessionService,
    CallHistoryService,
    {
      provide: 'TWILIO_WEBSOCKET_SERVER',
      useFactory: () => {
        const logger = new Logger('TwilioWebSocketServer');
        
        // Create a WebSocket server that will handle the media-stream endpoint
        const wss = new WebSocket.Server({ 
          noServer: true,
        });
        
        logger.log('WebSocket server for twilio-openai created');
        
        return wss;
      }
    }
  ],
  exports: [TwilioOpenaiService, TwilioPhoneService, SupabaseService, CallHistoryService, 'TWILIO_WEBSOCKET_SERVER'],
})
export class TwilioOpenaiModule {}