import { Module } from '@nestjs/common';
import { AgentConfigController } from './agent-config.controller';
import { AgentConfigService } from './agent-config.service';
import { SupabaseModule } from '../../utils/supabase/supabase.module';
import { ToolsModule } from '../tools/tool.module'; 

@Module({
  imports: [SupabaseModule, ToolsModule],
  controllers: [AgentConfigController],
  providers: [AgentConfigService],
  exports: [AgentConfigService]
})
export class AgentConfigModule {}
