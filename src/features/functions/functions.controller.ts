import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Req,
  UploadedFiles,
  UseInterceptors,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FunctionsService } from './functions.service';
import { CreateFunctionDto, UpdateFunctionDto } from './dto/function.dto';
import { Auth } from 'src/common/decorators/auth.decorator';
import { BadRequestException } from '@nestjs/common';
import { ApiConsumes, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

@Auth()
@ApiTags('Functions')
@Controller('functions')
export class FunctionsController {
  constructor(private readonly functionsService: FunctionsService) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all functions for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of all functions.' })
  async getAllFunctions(@Req() req) {
    try {
      return this.functionsService.getAllFunctions(req?.user?.id);
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get function by ID' })
  @ApiParam({ name: 'id', description: 'Function ID', required: true })
  @ApiResponse({ status: 200, description: 'Function details.' })
  @ApiResponse({ status: 404, description: 'Function not found.' })
  async getFunctionById(@Param('id') id: string, @Req() req) {
    return this.functionsService.getFunctionById(id, req?.user?.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new function' })
  @ApiBody({
    type: CreateFunctionDto,
    examples: {
      json_api_example: {
        value: {
          name: "query_company_info",
          purpose: "Search through company knowledge base for relevant information",
          trigger_reason: "when user asks a question related to company or business",
          assistant_id: "voice_agent_id",
          type: "json_api",
          data: {
            headers: {
              "Authorization": "Bearer {{access_token}}"
            },
            body: {
              "voiceAgentId": "{{voice_agent_id}}",
              "query": "{{query}}"
            },
            req_url: "https://build-operatorai-backend-production.up.railway.app/context",
            req_type: "POST"
          },
          variables: [
            {
              var_id: "1",
              var_name: "query",
              var_type: "text",
              var_reason: "The search query about company information",
              var_default: "true"
            }
          ]
        },
        description: 'Example of creating a new function for company knowledge base queries'
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Function created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data.' })
  async createFunction(
    @Body() createFunctionDto: CreateFunctionDto,
    @Req() req,
  ) {
    return this.functionsService.createFunction(
      createFunctionDto,
      req?.user?.id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing function' })
  @ApiParam({ name: 'id', description: 'Function ID', required: true })
  @ApiBody({ type: UpdateFunctionDto })
  @ApiResponse({ status: 200, description: 'Function updated successfully.' })
  @ApiResponse({ status: 404, description: 'Function not found.' })
  async updateFunction(
    @Param('id') id: string,
    @Body() updateFunctionDto: UpdateFunctionDto,
    @Req() req,
  ) {
    return this.functionsService.updateFunction(
      id,
      updateFunctionDto,
      req?.user?.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a function' })
  @ApiParam({ name: 'id', description: 'Function ID', required: true })
  @ApiResponse({ 
    status: 200, 
    description: 'Function deleted successfully.',
    schema: {
      properties: {
        message: { type: 'string', example: 'Function "query_company_info" deleted successfully' },
        deleted_function: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string' },
            purpose: { type: 'string' },
            created_at: { type: 'string' },
            created_by: { type: 'string' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Function not found.' })
  async deleteFunction(@Param('id') id: string, @Req() req) {
    return this.functionsService.deleteFunction(id, req?.user?.id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload files for a function' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          }
        }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Files uploaded successfully.' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFiles(@UploadedFiles() files: Express.Multer.File, @Req() req) {
    try {
      const urls = await this.functionsService.uploadFiles(
        files,
        req?.user?.id,
      );
      return { urls };
    } catch (error) {
      throw new BadRequestException(`Error uploading files: ${error.message}`);
    }
  }

  @Patch(':id/:status')
  @ApiOperation({ summary: 'Update function status' })
  @ApiParam({ name: 'id', description: 'Function ID', required: true })
  @ApiParam({ name: 'status', description: 'New status (true/false)', required: true })
  @ApiResponse({ status: 200, description: 'Function status updated successfully.' })
  @ApiResponse({ status: 404, description: 'Function not found.' })
  async updateFunctionStatus(
    @Param('id') id: string,
    @Param('status') status: boolean,
    @Req() req,
  ) {
    return this.functionsService.updateFunctionStatus(
      id,
      status,
      req?.user?.id,
    );
  }

  @Get('assistant/:assistant_id')
  @ApiOperation({ summary: 'Get functions (tools) based on assistant_id' })
  @ApiParam({ name: 'assistant_id', description: 'Assistant ID', required: true })
  @ApiResponse({ status: 200, description: 'List of functions for the given assistant_id.' })
  async getFunctionsByAssistantId(@Param('assistant_id') assistant_id: string) {
    return this.functionsService.getFunctionsByAssistantId(assistant_id);
  }

  // [POST] Updates default functions for all voice agents
  @Auth()
  @Post('update-default-functions')
  @ApiOperation({ 
    summary: '[Admin Only] Update default functions for all voice agents',
    description: 'Updates the default functions of all voice agents to match the current default configuration. Only administrators have access to this endpoint.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Default functions updated successfully',
    schema: {
      type: 'object',
      properties: {
        updated: { type: 'number', example: 15 },
        message: { type: 'string', example: 'Successfully updated 15 default functions across all voice agents' }
      }
    }
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Access denied. Only administrators can perform this operation.'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async updateAllDefaultFunctions(@Req() req) {
    try {
      return await this.functionsService.updateAllDefaultFunctions(req.user.id);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new HttpException(
          'Only administrators can update default functions',
          HttpStatus.FORBIDDEN
        );
      }
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
