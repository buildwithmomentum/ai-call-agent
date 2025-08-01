import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Injectable()
export class TwilioPhoneService {
  private readonly logger = new Logger(TwilioPhoneService.name);
  private readonly supabase;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  async getVoiceAgentIdByPhoneNumber(phoneNumber: string): Promise<string | null> {
    try {
      this.logger.log(`Searching for voice agent with phone number: ${phoneNumber}`);
      
      // First try: exact match with the provided number
      let { data, error } = await this.supabase
        .from('voice_agents')
        .select('id, twilio_phone_number')
        .eq('twilio_phone_number', phoneNumber)
        .limit(1);
        
      if (error) {
        this.logger.error(`Error in exact match query: ${error.message}`);
      } else if (data && data.length > 0) {
        this.logger.log(`Found exact match for phone number ${phoneNumber}`);
        return data[0].id;
      }
      
      // Second try: convert between formats
      // If input is compact format (+19895644594), try with spaces
      // If input has spaces (+1 989 564 4594), try compact format
      let alternateFormat: string;
      
      if (phoneNumber.includes(' ')) {
        // Convert from spaced to compact
        alternateFormat = phoneNumber.replace(/\s/g, '');
      } else {
        // Convert from compact to spaced
        // This assumes the format is like +19895644594
        if (phoneNumber.startsWith('+') && phoneNumber.length >= 12) {
          const countryCode = phoneNumber.substring(0, 2); // +1
          const areaCode = phoneNumber.substring(2, 5);    // 989
          const prefix = phoneNumber.substring(5, 8);      // 564
          const lineNumber = phoneNumber.substring(8);     // 4594
          
          alternateFormat = `${countryCode} ${areaCode} ${prefix} ${lineNumber}`;
        } else {
          this.logger.warn(`Phone number ${phoneNumber} is not in expected format`);
          return null;
        }
      }
      
      // Try the alternate format
      ({ data, error } = await this.supabase
        .from('voice_agents')
        .select('id, twilio_phone_number')
        .eq('twilio_phone_number', alternateFormat)
        .limit(1));
        
      if (error) {
        this.logger.error(`Error in alternate format query: ${error.message}`);
      } else if (data && data.length > 0) {
        this.logger.log(`Found match with alternate format: ${alternateFormat}`);
        return data[0].id;
      }
      
      this.logger.warn(`No voice agent found for phone number ${phoneNumber}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch voice agent: ${error.message}`, error.stack);
      return null;
    }
  }
}
