import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Req,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { Business } from '../../Models/business.model';
import { Auth } from '../../common/decorators/auth.decorator';
import { Request as ExpressRequest } from 'express';
import { CreateBusinessDTO } from './dto/create-business.dto';
import { UpdateBusinessDTO } from './dto/update-business.dto';
import { OperatingScheduleResponseDTO } from './dto/operating-schedule.dto';
import { UpdateOperatingScheduleDTO } from './dto/update-operating-schedule.dto';
import {
  BusinessResponseDTO,
  DeleteBusinessResponseDTO,
  UpdateBusinessResponseDTO,
  UpdateOperatingScheduleResponseDTO,
} from './dto/business-responses.dto';

@ApiTags('Business')
@ApiBearerAuth('Authorization')
@Controller('v1/business')
@Auth()
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  /**
   * Creates a new business entity and links it to a specified voice agent.
   * Requires authentication and validates voice agent ownership.
   * Allows partial operating schedule with default values for unspecified days.
   */
  @Post(':voice_agent_id')
  @ApiOperation({ 
    summary: 'Create a new business linked to a voice agent',
    description: 'Creates a business with operating schedule. Note: The business_summary field is auto-generated from the voice agent summary during training, so it is not required in the request body (but can be provided if desired).'
  })
  @ApiParam({
    name: 'voice_agent_id',
    description: 'The UUID of the voice agent to link the business to',
  })
  @ApiBody({ type: CreateBusinessDTO })
  @ApiResponse({ status: 201, type: BusinessResponseDTO, description: 'Business created successfully.' })
  @ApiResponse({ status: 409, description: 'A business is already linked to this voice agent' })
  @ApiResponse({ status: 403, description: 'Voice agent does not belong to the user' })
  @ApiResponse({ status: 400, description: 'Invalid timezone format or other validation error' })
  async create(
    @Param('voice_agent_id') voiceAgentId: string,
    @Body() businessData: CreateBusinessDTO,
    @Req() req: ExpressRequest & { user: any } 
  ): Promise<Business> {
    // Ensure voice_agent_id is provided.
    if (!voiceAgentId) {
      throw new HttpException('Voice agent id is required', HttpStatus.BAD_REQUEST);
    }

    // Validate ownership: compare token user id with voice_agents.created_by.
    await this.businessService.verifyVoiceAgentOwnership(voiceAgentId, req.user.id);

    // Validate timezone format if provided
    if (businessData.business_timezone) {
      try {
        await this.businessService.validateTimezone(businessData.business_timezone);
      } catch (error) {
        throw new HttpException(
          error.message,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Link the business to the provided voice agent id.
    const data = { ...businessData, voice_agent_id: voiceAgentId };
    try {
      return await this.businessService.create(data);
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Updates an existing business entity by its ID.
   * Allows partial updates of business details and operating schedule.
   * Only specified fields will be modified.
   */
  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update an existing business',
    description: 'Updates business details. Note: The business_summary field is auto-generated from the updated voice agent summary, so providing it is optional.'
  })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the business to update',
  })
  @ApiBody({ type: UpdateBusinessDTO })
  @ApiResponse({ status: 200, type: UpdateBusinessResponseDTO, description: 'Business updated successfully.' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  @ApiResponse({ status: 400, description: 'Invalid timezone format or other validation error' })
  async update(
    @Param('id') id: string,
    @Body() businessData: UpdateBusinessDTO
  ): Promise<UpdateBusinessResponseDTO> {
    // Validate timezone format if provided
    if (businessData.business_timezone) {
      try {
        await this.businessService.validateTimezone(businessData.business_timezone);
      } catch (error) {
        throw new HttpException(
          error.message,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    try {
      return await this.businessService.update(id, businessData);
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Deletes a business entity by its ID.
   * Returns the deleted business details including ID and name.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a business' })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the business to delete',
  })
  @ApiResponse({ status: 200, type: DeleteBusinessResponseDTO, description: 'Business deleted successfully' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async delete(@Param('id') id: string): Promise<DeleteBusinessResponseDTO> {
    try {
      return await this.businessService.delete(id);
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Retrieves the operating schedule of a business by voice agent ID.
   * Returns operating schedule and business ID.
   */
  @Get('schedule/:voice_agent_id')
  @ApiOperation({ 
    summary: 'Get operating schedule by voice agent ID',
    description: 'Retrieves the operating schedule and business ID for a business linked to the specified voice agent'
  })
  @ApiParam({
    name: 'voice_agent_id',
    description: 'The UUID of the voice agent whose business schedule to retrieve',
  })
  @ApiResponse({ status: 200, type: OperatingScheduleResponseDTO, description: 'Operating schedule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Business not found for the specified voice agent' })
  async getOperatingSchedule(@Param('voice_agent_id') voiceAgentId: string): Promise<OperatingScheduleResponseDTO> {
    try {
      return await this.businessService.getOperatingScheduleByVoiceAgentId(voiceAgentId);
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Updates specific days in the operating schedule without affecting other days.
   * Only the provided days will be updated, and only the provided fields for each day.
   */
  @Patch(':business_id/schedule')
  @ApiOperation({ 
    summary: 'Update specific days in the operating schedule',
    description: 'Updates only the provided days in the operating schedule without affecting other days. For each day, only the provided fields are updated.'
  })
  @ApiParam({
    name: 'business_id',
    description: 'The UUID of the business to update the schedule for (not voice agent ID)',
  })
  @ApiBody({ type: UpdateOperatingScheduleDTO })
  @ApiResponse({ status: 200, type: UpdateOperatingScheduleResponseDTO, description: 'Operating schedule updated successfully' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async updateOperatingSchedule(
    @Param('business_id') businessId: string,
    @Body() scheduleData: UpdateOperatingScheduleDTO
  ): Promise<UpdateOperatingScheduleResponseDTO> {
    try {
      return await this.businessService.updateOperatingSchedule(businessId, scheduleData.operating_schedule);
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Retrieves all business details by voice agent ID.
   * Returns complete business information including operating schedule.
   */
  @Get(':voice_agent_id/details')
  @ApiOperation({ 
    summary: 'Get complete business details by voice agent ID',
    description: 'Retrieves all business information including operating schedule, contact details, and business metadata for the specified voice agent'
  })
  @ApiParam({
    name: 'voice_agent_id',
    description: 'The UUID of the voice agent linked to the business',
  })
  @ApiResponse({ status: 200, type: BusinessResponseDTO, description: 'Business details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async getBusinessDetails(
    @Param('voice_agent_id') voiceAgentId: string
  ): Promise<BusinessResponseDTO> {
    return await this.businessService.getBusinessByVoiceAgentId(voiceAgentId);
  }
}
