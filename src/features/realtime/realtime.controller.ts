import { Controller, Get, Param } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get('session/:voice_agent_id')
  async getSession(@Param('voice_agent_id') voiceAgentId: string) {
    return this.realtimeService.createSession(voiceAgentId);
  }
}
