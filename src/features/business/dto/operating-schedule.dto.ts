import { ApiProperty } from '@nestjs/swagger';

class ScheduleTimeSlot {
  @ApiProperty({
    example: '09:00',
    description: 'Opening time in 24-hour format (HH:MM)'
  })
  opening_time: string;

  @ApiProperty({
    example: '17:00',
    description: 'Closing time in 24-hour format (HH:MM)'
  })
  closing_time: string;

  @ApiProperty({
    example: true,
    description: 'Whether the business is open on this day'
  })
  open: boolean;
}

export class DaySchedule {
  @ApiProperty({ type: ScheduleTimeSlot })
  Monday: ScheduleTimeSlot;

  @ApiProperty({ type: ScheduleTimeSlot })
  Tuesday: ScheduleTimeSlot;

  @ApiProperty({ type: ScheduleTimeSlot })
  Wednesday: ScheduleTimeSlot;

  @ApiProperty({ type: ScheduleTimeSlot })
  Thursday: ScheduleTimeSlot;

  @ApiProperty({ type: ScheduleTimeSlot })
  Friday: ScheduleTimeSlot;

  @ApiProperty({ type: ScheduleTimeSlot })
  Saturday: ScheduleTimeSlot;

  @ApiProperty({ type: ScheduleTimeSlot })
  Sunday: ScheduleTimeSlot;
}

export class OperatingScheduleResponseDTO {
  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Unique identifier for the business'
  })
  businessId: string;

  @ApiProperty({
    type: DaySchedule,
    description: 'Weekly operating schedule for the business'
  })
  operatingSchedule: DaySchedule;
} 