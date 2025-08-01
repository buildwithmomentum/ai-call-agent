import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { EventEmitter } from 'events';
import { ToolsService } from '../../features/tools/tools.service';

@Injectable()
export class AgentConfigService {
  private readonly supabase;
  public configChangesEmitter = new EventEmitter();

  // Added caching variables
  private configurationCache: Map<string, { config: { voiceAgent: any; business: any }; lastUpdated: number }> = new Map();
  private CACHE_TTL = 60000; // 60 seconds

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly toolsService: ToolsService // <-- injected ToolsService
  ) {
    this.supabase = supabaseService.getClient();
  }

  async getAgentConfig(voiceAgentId: string): Promise<{ voiceAgent: any; business: any }> {
    const { data: voiceAgent, error: agentError } = await this.supabase
      .from('voice_agents')
      .select('*')
      .eq('id', voiceAgentId)
      .single();
    if (agentError || !voiceAgent) {
      throw new NotFoundException(`Voice agent with id ${voiceAgentId} not found`);
    }

    const { data: business, error: businessError } = await this.supabase
      .from('business_details')
      .select('*')
      .eq('voice_agent_id', voiceAgentId)
      .single();
    if (businessError) {
      console.warn(`Business details for voice agent ${voiceAgentId} not found, proceeding with empty business object.`);
      return { voiceAgent, business: {} };
    }

    return { voiceAgent, business };
  }

  // New method to get configuration from cache or fetch it
  async getCachedAgentConfig(voiceAgentId: string): Promise<any> {
    const now = Date.now();
    const cached = this.configurationCache.get(voiceAgentId);
    if (cached && now - cached.lastUpdated < this.CACHE_TTL) {
      return cached.config;
    }
    const config = await this.getAgentConfig(voiceAgentId);
    // Fetch tools for the given voiceAgentId
    const tools = await this.toolsService.getTools(voiceAgentId);
    // Format SYSTEM_MESSAGE with tools inserted
    if (config.voiceAgent?.private_settings?.model) {
      config.voiceAgent.private_settings.model.SYSTEM_MESSAGE = this.formatSystemMessage(config.voiceAgent, config.business, tools);
    }
    this.configurationCache.set(voiceAgentId, { config, lastUpdated: now });
    return config;
  }

  // Updated subscription to clear the cache on any change events
  subscribeAgentConfigChanges(voiceAgentId: string) {
    const channel = this.supabase.channel('agent_config_channel')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'voice_agents', 
          filter: `id=eq.${voiceAgentId}` 
        }, (payload) => {
          this.configurationCache.delete(voiceAgentId);
          console.log(`[Cache Delete] voiceAgentId: ${voiceAgentId} on table: voice_agents`, payload);
          this.configChangesEmitter.emit('change', { table: 'voice_agents', payload });
        })
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'business_details', 
          filter: `voice_agent_id=eq.${voiceAgentId}` 
        }, (payload) => {
          this.configurationCache.delete(voiceAgentId);
          console.log(`[Cache Delete] voiceAgentId: ${voiceAgentId} on table: business_details`, payload);
          this.configChangesEmitter.emit('change', { table: 'business_details', payload });
        })
      .subscribe();
    return channel;
  }
  
  // New helper to convert 24-hour time (HH:MM) to 12-hour format (h:MM AM/PM)
  private convertTo12Hour(time: string): string {
    const [hourStr, minute] = time.split(':');
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
  }

  // Updated helper to transform the operating_schedule into a readable string with ordered days and times in 12-hour format
  private transformOperatingSchedule(schedule: any): string {
    if (!schedule) return '';
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const formatted = daysOrder.map(day => {
      const info = schedule[day];
      if (info) {
        return info.open 
          ? `${day}: Open from ${this.convertTo12Hour(info.opening_time)} to ${this.convertTo12Hour(info.closing_time)}`
          : `${day}: Closed`;
      }
      return '';
    }).filter(text => text !== '');
    return formatted.join(', ');
  }

  // Updated helper to replace placeholders in SYSTEM_MESSAGE; added third parameter "tools"
  private formatSystemMessage(voiceAgent: any, business: any, tools: any): string {
    let template = voiceAgent.private_settings?.model?.SYSTEM_MESSAGE || '';
    template = template
      .replace(/\$\{config\.name\}/g, voiceAgent.name)
      .replace(/\$\{config\.noAnswerMessage\}/g, voiceAgent.private_settings?.model?.noAnswerMessage || '')
      .replace(/\$\{config\.assistantLanguage\}/g, voiceAgent.private_settings?.model?.assistantLanguage || 'en')
      .replace(/\$\{config\.aiInputLanguage\}/g, voiceAgent.private_settings?.model?.aiInputLanguage || 'any')
      .replace(/\$\{business\.type_of_business\}/g, business?.type_of_business || '')
      .replace(/\$\{business\.business_name\}/g, business?.business_name || '')
      .replace(/\$\{business\.business_summary\}/g, business?.business_summary || '')
      .replace(/\$\{business\.additional_context\}/g, business?.additional_context || '')
      .replace(/\$\{business\.operating_schedule\}/g, this.transformOperatingSchedule(business?.operating_schedule) || '')
      .replace(/\$\{business\.default_appointment_length\}/g, business?.default_appointment_length || '60')
      .replace(/\$\{business\.business_timezone\}/g, business?.business_timezone || 'America/New_York')
      
    return template;
  }

  // Optionally, a method to unsubscribe can be added if needed
}
