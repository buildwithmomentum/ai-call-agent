import { ApiProperty } from '@nestjs/swagger';

export class BusinessResponseDTO {
  @ApiProperty({ type: 'string', format: 'uuid', example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Acme Corp' })
  business_name: string;

  @ApiProperty({ example: '+1234567890' })
  business_phone: string;

  @ApiProperty({ example: 'America/New_York', nullable: true })
  business_timezone?: string;

  @ApiProperty({ example: 'Retail' })
  type_of_business: string;

  @ApiProperty({ example: 'A retail store specializing in...', nullable: true })
  business_summary?: string;

  @ApiProperty({ example: 'Additional business information...', nullable: true })
  additional_context?: string;

  @ApiProperty({ type: 'string', format: 'uuid', example: 'voice-agent-uuid', nullable: true })
  voice_agent_id?: string;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: {
      type: 'object',
      properties: {
        opening_time: { type: 'string' },
        closing_time: { type: 'string' },
        open: { type: 'boolean' }
      }
    },
    example: {
      monday: {
        opening_time: '09:00',
        closing_time: '17:00',
        open: true
      }
    }
  })
  operating_schedule?: Record<string, any>;
}

export class DeleteBusinessResponseDTO {
  @ApiProperty({ example: 'Business deleted successfully' })
  message: string;

  @ApiProperty({ type: 'string', format: 'uuid', example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Acme Corp' })
  name: string;
}

export class UpdateBusinessResponseDTO {
  @ApiProperty({ example: 'Business updated successfully' })
  message: string;

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' },
    example: ['business_name', 'operating_schedule (days: Friday, Monday)']
  })
  updatedFields: string[];

  @ApiProperty({ type: BusinessResponseDTO })
  business: BusinessResponseDTO;
}

export class UpdateOperatingScheduleResponseDTO {
  @ApiProperty({ example: 'Operating schedule updated successfully' })
  message: string;

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' },
    example: ['Monday', 'Friday']
  })
  updatedDays: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        opening_time: { type: 'string' },
        closing_time: { type: 'string' },
        open: { type: 'boolean' }
      }
    },
    example: {
      Monday: { opening_time: '10:00', closing_time: '18:00', open: true },
      Tuesday: { opening_time: '09:00', closing_time: '17:00', open: true }
    }
  })
  operatingSchedule: Record<string, any>;
} 