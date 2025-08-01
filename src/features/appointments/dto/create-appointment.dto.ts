import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Voice agent ID to link the appointment', example: '92bb944f-032e-44c0-8f73-0acb7527bd45' })
  voice_agent_id: string;

  @ApiProperty({ description: 'Name of the person for whom the appointment is being booked', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'Phone number of the person booking the appointment', example: '(555) 123-4567' })
  phone_number: string;
  
  @ApiProperty({ description: 'Service associated with the appointment', example: 'Consultation' })
  service: string;
  
  @ApiProperty({ description: 'Special notes or instructions', required: false, example: 'Bring project plan' })
  special_notes?: string;

  @ApiProperty({ description: 'Scheduled time for the appointment', example: '2025-03-03T15:36:27Z' })
  schedule_time: string;
  
  // Optionally, status can be override, but defaults to "pending" in DB
  @ApiProperty({ description: 'Status of the appointment', example: 'pending', default: 'pending', required: false })
  status?: string;
}
