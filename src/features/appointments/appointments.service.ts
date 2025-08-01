import { Injectable, InternalServerErrorException, ConflictException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import * as moment from 'moment-timezone';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  private readonly supabase;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Creates a new appointment in the database
   * Returns the created appointment data if successful
   * Throws InternalServerErrorException if creation fails
   */
  async create(createAppointmentDto: CreateAppointmentDto): Promise<any> {
    try {
      // Convert ISO string to moment object directly
      const bookingDateTime = moment(createAppointmentDto.schedule_time);
      
      // Get business timezone and convert
      const businessTimezone = await this.getBusinessTimezone(createAppointmentDto.voice_agent_id);
      const bookingDateTimeLocal = bookingDateTime.tz(businessTimezone);

      // Format the date time in business timezone with timezone name
      const formattedDateTime = bookingDateTimeLocal.format('LLLL z');  // z will show the timezone abbreviation

      // Validate current date using business timezone
      const currentDateLocal = moment.tz(businessTimezone);
      if (bookingDateTimeLocal.isBefore(currentDateLocal)) {
        console.log(`Rejected past booking: ${bookingDateTime.toISOString()}`);
        return {
          success: false,
          message: 'Cannot book appointments in the past',
          error: 'INVALID_DATE',
          data: null
        };
      }

      // Get business details to check operating schedule
      const { data: businessDetails, error: businessError } = await this.supabase
        .from('business_details')
        .select('operating_schedule, default_appointment_length')
        .eq('voice_agent_id', createAppointmentDto.voice_agent_id)
        .single();

      if (businessError) {
        return {
          success: false,
          message: 'Failed to fetch business details',
          error: businessError.code,
          data: null
        };
      }

      // Get the day of the week for the appointment date
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = daysOfWeek[bookingDateTimeLocal.day()];
      
      // Check if business is open on the appointment day
      const operatingSchedule = businessDetails.operating_schedule || {};
      const daySchedule = operatingSchedule[dayOfWeek];
      
      if (!daySchedule || !daySchedule.open) {
        // Format date as Month DD, YYYY
        const formattedDate = bookingDateTimeLocal.format('MMMM DD, YYYY');

        return {
          success: false,
          message: `Cannot book appointment on ${dayOfWeek}, ${formattedDate} as the business is closed`,
          error: 'BUSINESS_CLOSED',
          data: null
        };
      }
      
      // Extract hours and minutes in business timezone
      const appointmentHours = bookingDateTimeLocal.hours();
      const appointmentMinutes = bookingDateTimeLocal.minutes();
      // Format as HH:MM for comparison
      const appointmentTime = `${appointmentHours.toString().padStart(2, '0')}:${appointmentMinutes.toString().padStart(2, '0')}`;
      const openingTime = daySchedule.opening_time;
      const closingTime = daySchedule.closing_time;
      
      if (appointmentTime < openingTime || appointmentTime >= closingTime) {
        // Format times for display in 12-hour format with AM/PM
        const formatTimeForDisplay = (date: moment.Moment) => {
          return date.format('hh:mm A');
        };

        // Format date as Month DD, YYYY
        const formattedDate = bookingDateTimeLocal.format('MMMM DD, YYYY');

        return {
          success: false,
          message: `Appointment time ${formatTimeForDisplay(bookingDateTimeLocal)} on ${dayOfWeek}, ${formattedDate} is outside business hours (${formatTimeForDisplay(moment(openingTime, 'HH:mm'))}) - ${formatTimeForDisplay(moment(closingTime, 'HH:mm'))})`,
          error: 'OUTSIDE_BUSINESS_HOURS',
          data: null
        };
      }

      // Check if appointment would extend beyond closing time
      const appointmentLengthMinutes = businessDetails.default_appointment_length || 60; // Default to 60 if not set

      // Calculate appointment end time in minutes since start of day
      const appointmentStartMinutes = appointmentHours * 60 + appointmentMinutes;
      const appointmentEndMinutes = appointmentStartMinutes + appointmentLengthMinutes;

      // Calculate closing time in minutes since start of day
      const [closingHours, closingMinutes] = closingTime.split(':').map(Number);
      const closingTimeMinutes = closingHours * 60 + closingMinutes;

      if (appointmentEndMinutes > closingTimeMinutes) {
        // Calculate the latest possible appointment start time
        const latestStartHours = Math.floor((closingTimeMinutes - appointmentLengthMinutes) / 60);
        const latestStartMinutes = (closingTimeMinutes - appointmentLengthMinutes) % 60;
        
        // Create a moment object for the latest start time for display formatting
        const latestPossibleDate = bookingDateTimeLocal.clone().hours(latestStartHours).minutes(latestStartMinutes);
        
        // Format for database query
        const latestPossibleISOString = latestPossibleDate.toISOString();
        
        // Check if this time is already booked
        const { data: existingAppointmentAtLatestTime, error: checkLatestTimeError } = await this.supabase
          .from('appointments')
          .select('id')
          .eq('voice_agent_id', createAppointmentDto.voice_agent_id) // or voiceAgentId for update
          .eq('schedule_time', latestPossibleISOString)
          .eq('status', 'pending')
          .single();
        
        if (checkLatestTimeError && checkLatestTimeError.code !== 'PGRST116') {
          return {
            success: false,
            message: 'Error checking latest available appointment time',
            error: 'DB_ERROR',
            data: null
          };
        }
        
        // Create moment to represent closing time
        const closingTimeDate = bookingDateTimeLocal.clone().hours(closingHours).minutes(closingMinutes);
        
        // Format date as Month DD, YYYY
        const formattedDate = bookingDateTimeLocal.format('MMMM DD, YYYY');
        
        let message = `Appointment starting at ${this.formatTimeForDisplay(bookingDateTimeLocal)} on ${dayOfWeek}, ${formattedDate} would end after business hours. Appointments are ${appointmentLengthMinutes} minutes long and must end by ${this.formatTimeForDisplay(closingTimeDate)}.`;
        
        if (existingAppointmentAtLatestTime) {
          message += ` The latest possible time (${this.formatTimeForDisplay(latestPossibleDate)}) is already booked. Please try another day.`;
        } else {
          message += ` The latest available start time is ${this.formatTimeForDisplay(latestPossibleDate)}.`;
        }
        
        return {
          success: false,
          message: message,
          error: 'EXTENDS_BEYOND_HOURS',
          data: null
        };
      }

      // Check for existing appointment with status 'pending' or 'completed'
      const { data: existingAppointment, error: checkError } = await this.supabase
        .from('appointments')
        .select('id, status')
        .eq('voice_agent_id', createAppointmentDto.voice_agent_id)
        .eq('schedule_time', bookingDateTime.toISOString())
        .eq('status', 'pending')  // Only check pending status
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        return {
          success: false,
          message: 'Database error while checking appointment availability',
          error: 'DB_ERROR',
          data: null
        };
      }

      if (existingAppointment) {
        return {
          success: false,
          message: `Appointment slot not available at ${formattedDateTime} (${bookingDateTime.toISOString()}). This time is already booked.`,
          error: 'SLOT_TAKEN',
          conflictDateTime: bookingDateTime.toISOString(),
          data: null
        };
      }

      // Proceed with appointment creation if no conflicts
      const { data, error } = await this.supabase
        .from('appointments')
        .insert([createAppointmentDto])
        .select()
        .single();

      if (error) {
        return {
          success: false,
          message: 'Failed to create appointment',
          error: error.code,
          details: error.message,
          data: null
        };
      }

      return {
        success: true,
        message: `Appointment successfully created for ${formattedDateTime} (${businessTimezone})`,
        error: null,
        data: {
          ...data,
          formatted_time: formattedDateTime,
          timezone: businessTimezone,
          timezone_date: bookingDateTimeLocal.format('LLLL')  // Adds formatted time in business timezone
        },
      };
    } catch (err) {
      return {
        success: false,
        message: 'Unexpected error while processing appointment',
        error: 'INTERNAL_ERROR',
        details: err.message,
        data: null
      };
    }
  }

  /**
   * Fetches all booked appointment slots for a voice agent
   * Returns slots for a single day
   */
  async getBookedSlots(voice_agent_id: string, date: string): Promise<any> {
    try {
      // Set time range for the single day
      const startOfDay = `${date}T00:00:00Z`;
      const endOfDay = `${date}T23:59:59Z`;

      // Query appointments for the specified day and voice agent, only pending status
      const { data, error } = await this.supabase
        .from('appointments')
        .select('schedule_time')
        .eq('voice_agent_id', voice_agent_id)
        .eq('status', 'pending')  // Only get pending appointments
        .gte('schedule_time', startOfDay)
        .lte('schedule_time', endOfDay)
        .order('schedule_time', { ascending: true });

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      // Return slots for the single day
      return {
        bookedSlots: {
          [date]: data.map(item => item.schedule_time)
        }
      };
    } catch (err) {
      throw new InternalServerErrorException(
        err.message || 'Failed to fetch booked slots'
      );
    }
  }

  async getAppointmentsByPhone(phone_number: string, voice_agent_id: string): Promise<any> {
    try {
      // Validate UUID format
      if (!this.isValidUUID(voice_agent_id)) {
        return {
          success: false,
          message: 'Invalid voice agent ID format',
          error: 'INVALID_UUID',
          data: []
        };
      }

      // Validate phone number
      if (!phone_number || phone_number.trim() === '') {
        return {
          success: false,
          message: 'Phone number is required',
          error: 'MISSING_PHONE_NUMBER',
          data: []
        };
      }

      // Clean phone number by removing special characters
      const cleanPhoneNumber = phone_number.replace(/[^\d]/g, '');
      
      // If cleaned phone number is empty, it means the input was invalid
      if (!cleanPhoneNumber) {
        return {
          success: false,
          message: 'Invalid phone number format',
          error: 'INVALID_PHONE_NUMBER',
          data: []
        };
      }

      const { data, error } = await this.supabase
        .from('appointments')
        .select('*')
        .like('phone_number', `%${cleanPhoneNumber}%`)
        .eq('voice_agent_id', voice_agent_id)
        .order('schedule_time', { ascending: true });

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch appointments',
          error: error.code,
          data: []
        };
      }

      // Check if no appointments were found
      if (!data || data.length === 0) {
        return {
          success: true,
          message: `No appointments found for phone number ${phone_number}`,
          data: []
        };
      }

      return {
        success: true,
        data: data  // Return raw data without formatting
      };
    } catch (err) {
      return {
        success: false,
        message: 'Unexpected error while fetching appointments',
        error: 'INTERNAL_ERROR',
        data: []
      };
    }
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto): Promise<any> {
    try {
      let formattedDateTime: string | undefined;
      
      // Validate appointment ID
      if (!id || !this.isValidUUID(id)) {
        return {
          success: false,
          message: 'Invalid appointment ID format',
          error: 'INVALID_UUID',
          data: null
        };
      }

      // Get current appointment details first
      const { data: currentAppointment, error: fetchError } = await this.supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        this.logger.error(`Failed to fetch appointment: ${fetchError.message}`);
        return {
          success: false,
          message: 'Failed to fetch current appointment details',
          error: fetchError.code,
          data: null
        };
      }

      // If voice_agent_id is provided, validate it
      if (updateAppointmentDto.voice_agent_id && !this.isValidUUID(updateAppointmentDto.voice_agent_id)) {
        return {
          success: false,
          message: 'Invalid voice agent ID format',
          error: 'INVALID_UUID',
          data: null
        };
      }

      // Use the correct voice agent ID for business details lookup
      const voiceAgentId = updateAppointmentDto.voice_agent_id || currentAppointment.voice_agent_id;

      // If schedule_time is being updated, handle timezone conversion
      if (updateAppointmentDto.schedule_time) {
        const businessTimezone = await this.getBusinessTimezone(
          voiceAgentId || 
          (await this.getCurrentAppointmentVoiceAgent(id))
        );

        const bookingDateTimeLocal = moment(updateAppointmentDto.schedule_time).tz(businessTimezone);
        
        // Validate future date using business timezone
        const currentDateLocal = moment.tz(businessTimezone);
        if (bookingDateTimeLocal.isBefore(currentDateLocal)) {
          return {
            success: false,
            message: 'Cannot update appointment to a past date',
            error: 'INVALID_DATE',
            data: null
          };
        }

        formattedDateTime = bookingDateTimeLocal.format('LLLL');

        // Get business details to check operating schedule
        const { data: businessDetails, error: businessError } = await this.supabase
          .from('business_details')
          .select('operating_schedule, default_appointment_length')
          .eq('voice_agent_id', voiceAgentId)
          .single();

        if (businessError) {
          return {
            success: false,
            message: 'Failed to fetch business details',
            error: businessError.code,
            data: null
          };
        }

        // Get the day of the week for the appointment date
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = daysOfWeek[bookingDateTimeLocal.day()];
        
        // Check if business is open on the appointment day
        const operatingSchedule = businessDetails.operating_schedule || {};
        const daySchedule = operatingSchedule[dayOfWeek];
        
        if (!daySchedule || !daySchedule.open) {
          // Format date as Month DD, YYYY
          const formattedDate = bookingDateTimeLocal.format('MMMM DD, YYYY');

          return {
            success: false,
            message: `Cannot update appointment to ${dayOfWeek}, ${formattedDate} as the business is closed`,
            error: 'BUSINESS_CLOSED',
            data: null
          };
        }
        
        // Extract hours and minutes in business timezone
        const appointmentHours = bookingDateTimeLocal.hours();
        const appointmentMinutes = bookingDateTimeLocal.minutes();
        // Format as HH:MM for comparison
        const appointmentTime = `${appointmentHours.toString().padStart(2, '0')}:${appointmentMinutes.toString().padStart(2, '0')}`;
        const openingTime = daySchedule.opening_time;
        const closingTime = daySchedule.closing_time;
        
        if (appointmentTime < openingTime || appointmentTime >= closingTime) {
          // Format times for display in 12-hour format with AM/PM
          const formatTimeForDisplay = (date: moment.Moment) => {
            return date.format('hh:mm A');
          };

          // Format date as Month DD, YYYY
          const formattedDate = bookingDateTimeLocal.format('MMMM DD, YYYY');

          return {
            success: false,
            message: `Appointment time ${formatTimeForDisplay(bookingDateTimeLocal)} on ${dayOfWeek}, ${formattedDate} is outside business hours (${formatTimeForDisplay(moment(openingTime, 'HH:mm'))}) - ${formatTimeForDisplay(moment(closingTime, 'HH:mm'))})`,
            error: 'OUTSIDE_BUSINESS_HOURS',
            data: null
          };
        }

        // Check if appointment would extend beyond closing time
        const appointmentLengthMinutes = businessDetails.default_appointment_length || 60; // Default to 60 if not set

        // Calculate appointment end time in minutes since start of day
        const appointmentStartMinutes = appointmentHours * 60 + appointmentMinutes;
        const appointmentEndMinutes = appointmentStartMinutes + appointmentLengthMinutes;

        // Calculate closing time in minutes since start of day
        const [closingHours, closingMinutes] = closingTime.split(':').map(Number);
        const closingTimeMinutes = closingHours * 60 + closingMinutes;

        if (appointmentEndMinutes > closingTimeMinutes) {
          // Calculate the latest possible appointment start time
          const latestStartHours = Math.floor((closingTimeMinutes - appointmentLengthMinutes) / 60);
          const latestStartMinutes = (closingTimeMinutes - appointmentLengthMinutes) % 60;
          
          // Create a moment object for the latest start time for display formatting
          const latestPossibleDate = bookingDateTimeLocal.clone().hours(latestStartHours).minutes(latestStartMinutes);
          
          // Format for database query
          const latestPossibleISOString = latestPossibleDate.toISOString();
          
          // Check if this time is already booked
          const { data: existingAppointmentAtLatestTime, error: checkLatestTimeError } = await this.supabase
            .from('appointments')
            .select('id')
            .eq('voice_agent_id', voiceAgentId) // or voiceAgentId for update
            .eq('schedule_time', latestPossibleISOString)
            .eq('status', 'pending')
            .single();
          
          if (checkLatestTimeError && checkLatestTimeError.code !== 'PGRST116') {
            return {
              success: false,
              message: 'Error checking latest available appointment time',
              error: 'DB_ERROR',
              data: null
            };
          }
          
          // Create moment to represent closing time
          const closingTimeDate = bookingDateTimeLocal.clone().hours(closingHours).minutes(closingMinutes);
          
          // Format date as Month DD, YYYY
          const formattedDate = bookingDateTimeLocal.format('MMMM DD, YYYY');
          
          let message = `Appointment starting at ${this.formatTimeForDisplay(bookingDateTimeLocal)} on ${dayOfWeek}, ${formattedDate} would end after business hours. Appointments are ${appointmentLengthMinutes} minutes long and must end by ${this.formatTimeForDisplay(closingTimeDate)}.`;
          
          if (existingAppointmentAtLatestTime) {
            message += ` The latest possible time (${this.formatTimeForDisplay(latestPossibleDate)}) is already booked. Please try another day.`;
          } else {
            message += ` The latest available start time is ${this.formatTimeForDisplay(latestPossibleDate)}.`;
          }
          
          return {
            success: false,
            message: message,
            error: 'EXTENDS_BEYOND_HOURS',
            data: null
          };
        }

        // Check for conflicting appointments (excluding the current one being updated)
        const { data: existingAppointment, error: checkError } = await this.supabase
          .from('appointments')
          .select('id')
          .eq('voice_agent_id', voiceAgentId)
          .eq('schedule_time', updateAppointmentDto.schedule_time)
          .eq('status', 'pending')  // Only check pending status
          .neq('id', id)  // Exclude the current appointment
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          return {
            success: false,
            message: 'Database error while checking appointment availability',
            error: 'DB_ERROR',
            data: null
          };
        }

        if (existingAppointment) {
          return {
            success: false,
            message: `Appointment slot not available at ${formattedDateTime} (${updateAppointmentDto.schedule_time}). This time is already booked.`,
            error: 'SLOT_TAKEN',
            conflictDateTime: updateAppointmentDto.schedule_time,
            data: null
          };
        }
      }

      const { data, error } = await this.supabase
        .from('appointments')
        .update(updateAppointmentDto)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          message: 'Failed to update appointment',
          error: error.code,
          details: error.message,
          data: null
        };
      }

      // Get formatted time for the response
      const businessTimezone = await this.getBusinessTimezone(data.voice_agent_id);
      const appointmentTime = moment.tz(data.schedule_time, 'UTC').tz(businessTimezone);
      formattedDateTime = appointmentTime.format('LLLL');

      return {
        success: true,
        message: 'Appointment successfully updated',
        data: {
          ...data,
          formatted_time: formattedDateTime
        }
      };
    } catch (err) {
      this.logger.error(`Update appointment error: ${err.message}`);
      return {
        success: false,
        message: 'Unexpected error while updating appointment',
        error: 'INTERNAL_ERROR',
        details: err.message,
        data: null
      };
    }
  }

  private isValidUUID(uuid: string): boolean {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid.trim());
  }

  private formatTimeForDisplay(date: moment.Moment): string {
    return date.format('hh:mm A');
  }

  private async getCurrentAppointmentVoiceAgent(appointmentId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select('voice_agent_id')
      .eq('id', appointmentId)
      .single();

    if (error) {
      throw new NotFoundException('Appointment not found');
    }

    return data.voice_agent_id;
  }

  // Helper method to get business timezone for a voice agent
  private async getBusinessTimezone(voiceAgentId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('business_details')
      .select('business_timezone')
      .eq('voice_agent_id', voiceAgentId)
      .single();
    
    if (error || !data) {
      this.logger.warn(`No business details found for voice agent ${voiceAgentId}. Using America/New_York as default.`);
      return 'America/New_York'; // Default to America/New_York if no business details found
    }
    
    return data.business_timezone || 'America/New_York'; // Return the timezone or default if not set
  }

  // Helper method to convert time between UTC and business timezone
  private convertTime(time: string, fromTimezone: string, toTimezone: string): string {
    return moment.tz(time, fromTimezone)
      .tz(toTimezone)
      .format();
  }
}
