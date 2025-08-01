import { ApiProperty } from '@nestjs/swagger';
import { IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class DayScheduleItem {
  @ApiProperty({
    example: '09:00',
    description: 'Opening time in 24-hour format (HH:MM)',
    required: false
  })
  @IsOptional()
  opening_time?: string;

  @ApiProperty({
    example: '17:00',
    description: 'Closing time in 24-hour format (HH:MM)',
    required: false
  })
  @IsOptional()
  closing_time?: string;

  @ApiProperty({
    example: true,
    description: 'Whether the business is open on this day',
    required: false
  })
  @IsOptional()
  open?: boolean;
}

export class UpdateOperatingScheduleDTO {
  @ApiProperty({
    description: 'Partial operating schedule with only the days that need to be updated',
    example: {
      Monday: { opening_time: '10:00', closing_time: '18:00', open: true },
      Friday: { open: false }
    },
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        opening_time: { type: 'string' },
        closing_time: { type: 'string' },
        open: { type: 'boolean' }
      }
    }
  })
  @IsObject()
  @ValidateNested()
  @Type(() => DayScheduleItem)
  operating_schedule: Record<string, DayScheduleItem>;
} 