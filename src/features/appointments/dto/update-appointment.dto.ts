import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, IsISO8601, IsEnum } from 'class-validator';

export enum AppointmentStatus {
    PENDING = 'pending',
    MISSED = 'missed',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export class UpdateAppointmentDto {
    @ApiProperty({ description: 'Appointment UUID' })
    @IsUUID()
    id: string;

    @ApiProperty({ description: 'Voice agent UUID', required: false })
    @IsUUID()
    @IsOptional()
    voice_agent_id?: string;

    @ApiProperty({ description: 'Client name', required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ description: 'Client phone number', required: false })
    @IsString()
    @IsOptional()
    phone_number?: string;

    @ApiProperty({ description: 'Service requested', required: false })
    @IsString()
    @IsOptional()
    service?: string;

    @ApiProperty({ description: 'Special notes or requests', required: false })
    @IsString()
    @IsOptional()
    special_notes?: string;

    @ApiProperty({ description: 'Appointment scheduled time (ISO format)', required: false })
    @IsISO8601()
    @IsOptional()
    schedule_time?: string;

    @ApiProperty({ description: 'Appointment status', required: false, enum: AppointmentStatus })
    @IsEnum(AppointmentStatus)
    @IsOptional()
    status?: AppointmentStatus;
}
