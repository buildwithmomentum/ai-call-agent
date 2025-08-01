import { Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { AgentConfigModule } from '../agent-config/agent-config.module';
import { ToolsModule } from '../tools/tool.module'; // <-- Import ToolsModule

@Module({
  imports: [AgentConfigModule, ToolsModule], // <-- Add ToolsModule into imports
  controllers: [RealtimeController],
  providers: [RealtimeService],
})
export class RealtimeModule {}
