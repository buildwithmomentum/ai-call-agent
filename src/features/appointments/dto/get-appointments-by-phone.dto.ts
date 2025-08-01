import { ApiProperty } from '@nestjs/swagger';

export class GetAppointmentsByPhoneDto {
  @ApiProperty({ description: 'Phone number to search appointments', example: '(555) 123-4567' })
  phone_number: string;

  @ApiProperty({ description: 'Voice agent ID', example: '92bb944f-032e-44c0-8f73-0acb7527bd45' })
  voice_agent_id: string;
}
