import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { Business } from '../../Models/business.model';
import { OperatingScheduleResponseDTO } from './dto/operating-schedule.dto';

@Injectable()
export class BusinessService {
  private readonly supabase;
  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  // Validate IANA timezone format
  async validateTimezone(timezone: string): Promise<boolean> {
    // This is a simple regex to validate the format of Region/City
    const ianaTimezoneRegex = /^[A-Za-z_]+\/[A-Za-z_]+$/;
    
    if (!ianaTimezoneRegex.test(timezone)) {
      throw new Error(
        'Invalid timezone format. Please use IANA timezone identifier (e.g., America/New_York, Europe/London)'
      );
    }
    
    // For more accurate validation, you could check against a list of valid IANA timezones
    // or use a library like moment-timezone to verify
    
    return true;
  }

  // Create a new business entry.
  async create(data: Partial<Business>): Promise<Business> {
    // Create default operating schedule
    const defaultSchedule = {
      Monday: { opening_time: "09:00", closing_time: "17:00", open: true },
      Tuesday: { opening_time: "09:00", closing_time: "17:00", open: true },
      Wednesday: { opening_time: "09:00", closing_time: "17:00", open: true },
      Thursday: { opening_time: "09:00", closing_time: "17:00", open: true },
      Friday: { opening_time: "09:00", closing_time: "17:00", open: true },
      Saturday: { opening_time: "09:00", closing_time: "17:00", open: false },
      Sunday: { opening_time: "09:00", closing_time: "17:00", open: false }
    };

    // If operating_schedule is provided, merge it with defaults
    if (data.operating_schedule) {
      const providedSchedule = data.operating_schedule;
      for (const day in providedSchedule) {
        defaultSchedule[day] = {
          opening_time: providedSchedule[day].opening_time,
          closing_time: providedSchedule[day].closing_time,
          open: providedSchedule[day].open
        };
      }
    }

    // Use the merged schedule
    const businessData = {
      ...data,
      operating_schedule: defaultSchedule
    };

    const { data: business, error } = await this.supabase
      .from('business_details')
      .insert(businessData)
      .select()
      .single();

    if (error) {
      if (error.message && error.message.includes("unique_voice_agent_business")) {
        throw new HttpException('A business is already linked to this voice agent', HttpStatus.CONFLICT);
      }
      throw error;
    }
    return business;
  }

  async verifyVoiceAgentOwnership(voiceAgentId: string, userId: string): Promise<void> {
    const { data: voiceAgent, error } = await this.supabase
      .from('voice_agents')
      .select('created_by')
      .eq('id', voiceAgentId)
      .single();
    if (error || !voiceAgent) {
      throw new HttpException('Voice agent not found', HttpStatus.NOT_FOUND);
    }
    if (voiceAgent.created_by !== userId) {
      throw new HttpException('Voice agent does not belong to the user', HttpStatus.FORBIDDEN);
    }
  }

  // Update an existing business.
  async update(id: string, data: Partial<Business>): Promise<{ message: string, updatedFields: string[], business: Business }> {
    // Capture original update payload keys.
    const updatePayloadKeys = Object.keys(data);
    let scheduleUpdatedDays: string[] = [];
    
    // Fetch the existing business record.
    const { data: existingBusiness, error: fetchError } = await this.supabase
      .from('business_details')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError || !existingBusiness) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    // Merge operating_schedule if provided.
    if (data.operating_schedule) {
      const currentSchedule = existingBusiness.operating_schedule || {};
      const newSchedule = data.operating_schedule;
      scheduleUpdatedDays = Object.keys(newSchedule);
      for (const day in newSchedule) {
        currentSchedule[day] = {
          opening_time: newSchedule[day].opening_time ?? currentSchedule[day]?.opening_time,
          closing_time: newSchedule[day].closing_time ?? currentSchedule[day]?.closing_time,
          open: newSchedule[day].open ?? currentSchedule[day]?.open,
        };
      }
      data.operating_schedule = currentSchedule;
    }

    // Perform update.
    const { data: business, error } = await this.supabase
      .from('business_details')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    // Compose updated fields information.
    let updatedFields = updatePayloadKeys.filter(key => key !== 'operating_schedule');
    if (scheduleUpdatedDays.length > 0) {
      updatedFields.push(`operating_schedule (days: ${scheduleUpdatedDays.join(', ')})`);
    }
    
    return {
      message: 'Business updated successfully',
      updatedFields,
      business
    };
  }

  // Delete a business entry.
  async delete(id: string): Promise<{ message: string; id: string; name: string }> {
    // First fetch the business to get its name
    const { data: business, error: fetchError } = await this.supabase
      .from('business_details')
      .select('business_name')
      .eq('id', id)
      .single();
    
    if (fetchError || !business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    // Perform deletion
    const { error } = await this.supabase
      .from('business_details')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return { 
      message: 'Business deleted successfully', 
      id,
      name: business.business_name 
    };
  }

  // Get operating schedule by voice agent ID
  async getOperatingScheduleByVoiceAgentId(voiceAgentId: string): Promise<OperatingScheduleResponseDTO> {
    const { data: business, error } = await this.supabase
      .from('business_details')
      .select('id, operating_schedule')
      .eq('voice_agent_id', voiceAgentId)
      .single();
    
    if (error || !business) {
      throw new NotFoundException(`Business with voice agent ID ${voiceAgentId} not found`);
    }
    
    return {
      businessId: business.id,
      operatingSchedule: business.operating_schedule
    };
  }

  // Update specific days in the operating schedule
  async updateOperatingSchedule(businessId: string, updatedSchedule: Record<string, any>): Promise<{ message: string; updatedDays: string[]; operatingSchedule: any }> {
    // Fetch the existing business record
    const { data: business, error: fetchError } = await this.supabase
      .from('business_details')
      .select('operating_schedule')
      .eq('id', businessId)
      .single();
    
    if (fetchError || !business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Get the current schedule
    const currentSchedule = business.operating_schedule || {};
    
    // Track which days were updated
    const updatedDays: string[] = [];

    // Update only the provided days
    for (const day in updatedSchedule) {
      updatedDays.push(day);
      
      // Merge the updated day's settings with existing settings
      currentSchedule[day] = {
        ...currentSchedule[day],
        ...updatedSchedule[day]
      };
    }

    // Update the database
    const { data: updatedBusiness, error } = await this.supabase
      .from('business_details')
      .update({ operating_schedule: currentSchedule })
      .eq('id', businessId)
      .select('operating_schedule')
      .single();
    
    if (error) throw error;
    
    return {
      message: 'Operating schedule updated successfully',
      updatedDays,
      operatingSchedule: updatedBusiness.operating_schedule
    };
  }

  // Get business details by voice agent ID
  async getBusinessByVoiceAgentId(voiceAgentId: string): Promise<Business> {
    const { data: business, error } = await this.supabase
      .from('business_details')
      .select('*')
      .eq('voice_agent_id', voiceAgentId)
      .single();
    
    if (error || !business) {
      throw new NotFoundException(`Business with voice agent ID ${voiceAgentId} not found`);
    }
    
    return business;
  }
}
