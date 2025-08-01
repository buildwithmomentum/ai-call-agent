import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DayScheduleDTO {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsOptional()
  opening_time?: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @IsOptional()
  closing_time?: string;
  
  @ApiProperty({ example: true })
  @IsOptional()
  open?: boolean;
}

export class UpdateBusinessDTO {
  @ApiProperty({ example: 'New Business Name' })
  @IsString()
  @IsOptional()
  business_name?: string;

  @ApiProperty({ example: '+19876543210' })
  @IsString()
  @IsOptional()
  business_phone?: string;

  @ApiProperty({ example: 'Wholesale' })
  @IsString()
  @IsOptional()
  type_of_business?: string;

  @ApiProperty({ example: 'New location details' })
  @IsString()
  @IsOptional()
  additional_context?: string;

  @ApiProperty({
    example: 'Europe/London',
    description: 'IANA timezone identifier (e.g., America/New_York, Europe/London, Asia/Tokyo)'
  })
  @IsString()
  @IsOptional()
  business_timezone?: string;

  @ApiProperty({
    description: 'Only days that need to be updated. Other days will remain unchanged.',
    example: {
      Monday: { opening_time: "10:00", closing_time: "16:00", open: true }
    },
    additionalProperties: true
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDTO)
  operating_schedule?: Record<string, DayScheduleDTO>;
} 