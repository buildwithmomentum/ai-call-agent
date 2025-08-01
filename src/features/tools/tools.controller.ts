import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ToolsService } from './tools.service';

@ApiTags('Tools')
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get(':assistant_id')
  @ApiOperation({ summary: 'Get tools by assistant id' })
  @ApiParam({ name: 'assistant_id', description: 'Assistant identifier', required: true })
  @ApiResponse({ status: 200, description: 'List of tools for the given assistant id.' })
  async getTools(@Param('assistant_id') assistantId: string) {
    return this.toolsService.getTools(assistantId);
  }

  @Get('function-data/:assistant_id')  // Changed from ':assistant_id/function-data'
  @ApiOperation({ summary: 'Get function data by assistant id' })
  @ApiParam({ name: 'assistant_id', description: 'Assistant identifier', required: true })
  @ApiResponse({ status: 200, description: 'Function data for the given assistant id.' })
  async getFunctionData(@Param('assistant_id') assistantId: string) {
    return this.toolsService.getFunctionData(assistantId);
  }
}
