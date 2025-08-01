import { Controller, Post, Body, Get, Query, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { GetBookedSlotsDto } from './dto/get-booked-slots.dto';
import { GetAppointmentsByPhoneDto } from './dto/get-appointments-by-phone.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new appointment' })
  @ApiBody({ type: CreateAppointmentDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Appointment created successfully.'
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Get('booked-slots')
  @ApiOperation({ summary: 'Get booked appointment slots for a specific day' })
  @ApiQuery({ name: 'voice_agent_id', type: String })
  @ApiQuery({ name: 'date', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of booked time slots'
  })
  async getBookedSlots(
    @Query('voice_agent_id') voice_agent_id: string,
    @Query('date') date: string
  ) {
    return this.appointmentsService.getBookedSlots(voice_agent_id, date);
  }

  @Get('by-phone')
  @ApiOperation({ summary: 'Get all appointments for a specific phone number and voice agent' })
  @ApiQuery({ name: 'phone_number', type: String })
  @ApiQuery({ name: 'voice_agent_id', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of appointments for the given phone number and voice agent'
  })
  async getAppointmentsByPhone(
    @Query('phone_number') phone_number: string,
    @Query('voice_agent_id') voice_agent_id: string
  ) {
    return this.appointmentsService.getAppointmentsByPhone(phone_number, voice_agent_id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update appointment details' })
  async update(@Body() updateDto: UpdateAppointmentDto) {
    const { id, ...updateData } = updateDto;
    return this.appointmentsService.update(id, {
      ...updateData,
      id // Include id in the update data to satisfy DTO requirements
    });
  }
}
