import { Controller, Get, Param, HttpException, HttpStatus, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Observable, fromEvent } from 'rxjs';
import { AgentConfigService } from './agent-config.service';

@ApiTags('Agent Config')
@Controller('agent-config')
export class AgentConfigController {
  constructor(private readonly agentConfigService: AgentConfigService) {}

  @Get(':voice_agent_id')
  @ApiOperation({ summary: 'Get voice agent details and its business config' })
  @ApiParam({
    name: 'voice_agent_id',
    type: 'string',
    description: 'Voice agent UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the voice agent details along with its associated business details',
  })
  async getAgentConfig(@Param('voice_agent_id') voiceAgentId: string) {
    try {
      const result = await this.agentConfigService.getAgentConfig(voiceAgentId);
      console.log('Voice Agent Config:', result); // Log output to terminal
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Sse('realtime/:voice_agent_id')
  @ApiOperation({ summary: 'Subscribe to realtime changes for agent config' })
  @ApiParam({
    name: 'voice_agent_id',
    type: 'string',
    description: 'Voice agent UUID',
  })
  realtimeConfigChanges(@Param('voice_agent_id') voiceAgentId: string): Observable<any> {
    // Subscribe to realtime changes for given voiceAgentId
    this.agentConfigService.subscribeAgentConfigChanges(voiceAgentId);
    // Return an observable from the EventEmitter
    return fromEvent(this.agentConfigService.configChangesEmitter, 'change');
  }
}
