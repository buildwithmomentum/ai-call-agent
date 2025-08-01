import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DayScheduleDTO {
  @ApiProperty({ example: '09:00' })
  @IsString()
  opening_time: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  closing_time: string;
  
  @ApiProperty({ example: true })
  open: boolean;
}

export class CreateBusinessDTO {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  business_name: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  business_phone: string;

  @ApiProperty({ example: 'Retail' })
  @IsString()
  type_of_business: string;

  @ApiProperty({ 
    example: 'Located in downtown'
  })
  @IsString()
  @IsOptional()
  additional_context?: string;

  @ApiProperty({
    example: 'America/New_York',
    description: 'IANA timezone identifier (e.g., America/New_York, Europe/London, Asia/Tokyo)'
  })
  @IsString()
  @IsOptional()
  business_timezone?: string;

  @ApiProperty({
    description: 'Business operating schedule',
    example: {
      Monday: { opening_time: "09:00", closing_time: "17:00", open: true },
      Tuesday: { opening_time: "09:00", closing_time: "17:00", open: true }
    },
    additionalProperties: true
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDTO)
  operating_schedule?: Record<string, DayScheduleDTO>;
} 