import {
  Source,
  SourceCreateDTO,
  SourceUpdateDTO,
  SourceStatusUpdateDTO,
  defaultSource,
} from '../../Models/source.model';
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Injectable()
export class SourceService {
  private readonly supabase;
  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = supabaseService.getClient();
  }

  public async createSource(
    sourceData: SourceCreateDTO,
    voiceAgentId: string,
  ): Promise<Source> {
    const { data, error } = await this.supabase
      .from('sources')
      .insert({ ...defaultSource, ...sourceData, voice_agent_id: voiceAgentId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async getSource(sourceId: string): Promise<Source> {
    const { data, error } = await this.supabase
      .from('sources')
      .select()
      .eq('id', sourceId)
      .single();

    if (error) throw error;
    return data;
  }

  public async getSources(voiceAgentId: string): Promise<Source[]> {
    const { data, error } = await this.supabase
      .from('sources')
      .select()
      .eq('voice_agent_id', voiceAgentId);

    if (error) throw error;
    return data || [];
  }

  public async updateSource(
    sourceId: string,
    sourceData: SourceUpdateDTO,
    voiceAgentId: string,
  ): Promise<Source> {
    const { data, error } = await this.supabase
      .from('sources')
      .update(sourceData)
      .eq('id', sourceId)
      .eq('voice_agent_id', voiceAgentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async deleteSource(
    sourceId: string,
    voiceAgentId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sources')
      .delete()
      .eq('id', sourceId)
      .eq('voice_agent_id', voiceAgentId);

    if (error) throw error;
  }

  public async listSources(voiceAgentId: string): Promise<Source[]> {
    const { data, error } = await this.supabase
      .from('sources')
      .select()
      .eq('voice_agent_id', voiceAgentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  public async updateSourceStatus(
    sourceId: string,
    statusData: SourceStatusUpdateDTO,
    voiceAgentId: string,
  ): Promise<Source> {
    const { data, error } = await this.supabase
      .from('sources')
      .update(statusData)
      .eq('id', sourceId)
      .eq('voice_agent_id', voiceAgentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
