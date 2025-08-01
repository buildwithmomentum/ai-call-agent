import { Injectable } from '@nestjs/common';
import { AgentConfigService } from '../agent-config/agent-config.service';
import { ToolsService } from '../tools/tools.service';


@Injectable()
export class RealtimeService {
  constructor(
    private readonly agentConfigService: AgentConfigService,
    private readonly toolsService: ToolsService // <-- new injection
  ) {}

  async createSession(voiceAgentId: string) {
    // Get configuration including dynamic SYSTEM_MESSAGE
    const config = await this.agentConfigService.getCachedAgentConfig(voiceAgentId);
    const model = config?.voiceAgent?.private_settings?.model?.model;
    const voice = config?.voiceAgent?.private_settings?.model?.voice;
    const temperature = config?.voiceAgent?.private_settings?.model?.temperature;
    const SYSTEM_MESSAGE = config?.voiceAgent?.private_settings?.model?.SYSTEM_MESSAGE;

    // Fetch dynamically converted tools from ToolsService
    const tools = await this.toolsService.getTools(voiceAgentId);

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-realtime-preview-2024-12-17',
        voice: voice || 'alloy',
        temperature: temperature,
        instructions: SYSTEM_MESSAGE,
        input_audio_transcription: {
          model: 'whisper-1',
          language: 'en',
         
        },
        
        tools: tools, // Use dynamically fetched tools
        tool_choice: 'auto',
      }),
    });
    return response.json();
  }
}
