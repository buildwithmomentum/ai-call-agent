import {
  Controller,
  Get,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  Request,
  Patch,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { Auth } from '../../common/decorators/auth.decorator';
import { CustomerUpdateDTO, UpdateCreditsDTO, UpdateCustomerDetailsDTO } from '../../Models/user.model';

@ApiTags('Customer')
@ApiBearerAuth('Authorization')  
@Controller('customers')
@Auth()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'Get logged-in customer data' })
  @ApiResponse({ status: 200, description: 'Returns customer details for the authenticated user.' })
  async findLoggedIn(@Request() req) {
    try {
      const user = req.user;
      return await this.customerService.findOne(user.id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get customer data by UUID' })
  @ApiResponse({ status: 200, description: 'Returns customer details for the given UUID.' })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  async findOne(@Param('uuid') uuid: string) {
    try {
      const customer = await this.customerService.findOne(uuid);
      if (!customer) {
        throw new HttpException('Customer not found', HttpStatus.NOT_FOUND);
      }
      return customer;
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('email/:email')
  @ApiOperation({ summary: 'Get customer data by email' })
  @ApiResponse({ status: 200, description: 'Returns customer details for the provided email.' })
  @ApiResponse({ status: 404, description: 'Customer not found with the given email.' })
  async findByEmail(@Param('email') email: string) {
    try {
      const customer = await this.customerService.findByEmail(email);
      if (!customer) {
        throw new HttpException('Customer not found', HttpStatus.NOT_FOUND);
      }
      return customer;
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete()
  @ApiOperation({ summary: 'Delete the logged-in customer and all related data' })
  @ApiResponse({
    status: 200,
    description: 'Successfully deleted the customer and related data',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        deletedCustomer: {
          type: 'object',
          properties: {
            uuid: { type: 'string' },
            email: { type: 'string' },
            plan: { type: 'string' }
          }
        },
        deletedVoiceAgents: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        },
        deletedAccessEntries: { type: 'number' }
      }
    }
  })
  async remove(@Request() req) {
    try {
      return await this.customerService.remove(req.user.id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':uuid/credits')
  @ApiOperation({ summary: 'Update customer credits by UUID' })
  @ApiParam({
    name: 'uuid',
    description: 'The UUID of the customer to update credits for',
    required: true,
    type: String
  })
  @ApiBody({ type: UpdateCreditsDTO })
  @ApiResponse({
    status: 200,
    description: 'Customer credits updated successfully.',
    type: UpdateCreditsDTO
  })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async updateCredits(
    @Param('uuid') uuid: string,
    @Body() updateCreditsDto: UpdateCreditsDTO
  ) {
    try {
      return await this.customerService.updateCredits(uuid, updateCreditsDto.credits);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('update-profile') // renamed route from update-details to update-profile
  @ApiOperation({ summary: 'Update customer profile (username, phone, company, title)' })
  @ApiBody({
    description: 'Request body to update customer profile. Email cannot be updated.',
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'new_username' },
        phone: { type: 'string', example: '+1234567890' },
        company: { type: 'string', example: 'New Company' },
        title: { type: 'string', example: 'New Title' },
      },
    },
  })
  @ApiResponse({ 
    status: 200,
    description: 'Customer profile updated successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Email cannot be updated',
    
  })
  async updateProfile(@Request() req, @Body() details: UpdateCustomerDetailsDTO) {
    // Prevent email changes by ignoring any provided email
    return await this.customerService.updateCustomerDetails(req.user.id, details);
  }
}
