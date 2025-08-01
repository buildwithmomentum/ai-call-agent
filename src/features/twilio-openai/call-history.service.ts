import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Injectable()
export class CallHistoryService {
  private readonly logger = new Logger(CallHistoryService.name);
  private readonly supabase;

  constructor(
    private readonly supabaseService: SupabaseService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Fetches previous call summary for a specific caller and agent
   * @param agentId - The ID of the voice agent
   * @param callerNumber - The phone number of the caller
   * @returns A string containing the call summary or null if no previous calls exist
   */
  async getPreviousCallSummary(agentId: string, callerNumber: string): Promise<string | null> {
    try {
      this.logger.log(`📞 Fetching previous call summary for caller ${callerNumber} with agent ${agentId}`);
      
      // Query the call_logs table for previous calls from this number with this agent
      const { data, error } = await this.supabase
        .from('call_logs')
        .select('summary, call_start, duration')
        .eq('voice_agent_id', agentId)
        .eq('caller_number', callerNumber)
        .order('call_start', { ascending: false })
        .limit(1);

      if (error) {
        this.logger.error(`Error fetching previous call summary: ${error.message}`);
        return null;
      }

      if (data && data.length > 0 && data[0].summary) {
        // Log call details to terminal
        const callDate = new Date(data[0].call_start).toLocaleString();
        this.logger.log(`📅 Found previous call from: ${callDate} (Duration: ${data[0].duration || 'N/A'})`);
        
        // Return the summary from the most recent call
        const summaryData = data[0].summary;
        if (typeof summaryData === 'string') {
          return summaryData;
        } else if (typeof summaryData === 'object') {
          // If summary is stored as a JSON object, extract the relevant text
          return summaryData.text || summaryData.summary || JSON.stringify(summaryData);
        }
      }

      this.logger.log(`❌ No previous calls found for caller ${callerNumber} with agent ${agentId}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to get previous call summary: ${error.message}`);
      return null;
    }
  }

  /**
   * Gets call history for a specific caller
   * @param callerNumber - The phone number of the caller
   * @param limit - Maximum number of records to retrieve
   * @returns Array of call log records or empty array if none exist
   */
  async getCallerHistory(callerNumber: string, limit = 5): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('call_logs')
        .select('id, voice_agent_id, call_start, call_end, duration, summary, status')
        .eq('caller_number', callerNumber)
        .order('call_start', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error(`Error fetching caller history: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Failed to get caller history: ${error.message}`);
      return [];
    }
  }

  /**
   * Builds a contextual greeting based on the caller's history
   * @param agentId - The ID of the voice agent
   * @param callerNumber - The phone number of the caller
   * @returns A string containing the appropriate greeting text with context
   */
  async buildContextualGreeting(agentId: string, callerNumber: string): Promise<string> {
    const summary = await this.getPreviousCallSummary(agentId, callerNumber);
    
    if (summary) {
      return `Returning caller ${callerNumber}. Previous call: "${summary}". 
      Greet them warmly, mention your name and briefly reference their last call.`;
    } else {
      return `First-time caller ${callerNumber}. Introduce yourself and greet them warmly.`;
    }
  }
}