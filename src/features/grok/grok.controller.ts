import { Controller, Post, Get, Body, Logger, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GrokService } from './grok.service';
import { GrokChatDto } from './dto/grok-chat.dto';
import { SimpleMessageDto } from './dto/simple-message.dto';
import { GrokChatResponse } from './types/grok.types';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

// Create a class for Swagger documentation to fix the type error
class GrokChatResponseDto implements GrokChatResponse {
  content: string;
  model: string;
  success: boolean;
  error?: string;
}

@ApiTags('Grok')
@Controller('grok')
export class GrokController {
  private readonly logger = new Logger(GrokController.name);

  constructor(
    private readonly grokService: GrokService,
    private readonly configService: ConfigService
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Generate chat completion using Grok AI with configuration options' })
  @ApiResponse({ 
    status: 200, 
    description: 'Success response with AI-generated content',
    type: GrokChatResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async generateSimpleChatCompletion(
    @Body() simpleMessageDto: SimpleMessageDto,
    @Query('model') model?: string,
    @Query('temperature') temperature?: number,
    @Query('systemMessage') systemMessage?: string,
  ): Promise<GrokChatResponse> {
    this.logger.log(`Received chat request: ${simpleMessageDto.message.substring(0, 50)}...`);
    
    return this.grokService.generateChatCompletion(
      simpleMessageDto.message,
      systemMessage,
      model,
      temperature
    );
  }

  @Get('stream')
  @ApiOperation({ summary: 'Stream chat completion using Grok AI (GET for EventSource)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Streamed response with AI-generated content chunks'
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async streamChatCompletionGet(
    @Query('message') message: string,
    @Res() response: Response,
    @Query('model') model?: string,
    @Query('temperature') temperature?: number,
    @Query('systemMessage') systemMessage?: string,
  ): Promise<void> {
    if (!message) {
      response.write(`event: error\ndata: ${JSON.stringify({ 
        content: "No message provided in query parameters.",
        model: "grok-2-latest",
        success: false,
        error: "Missing message"
      })}\n\n`);
      response.end();
      return;
    }
    
    this.logger.log(`Received GET streaming chat request: ${message.substring(0, 50)}...`);
    
    // Set appropriate headers for SSE (Server-Sent Events)
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');  // Important for CORS
    
    // Stream the response
    return this.grokService.streamChatCompletion(
      response,
      message,
      systemMessage,
      model,
      temperature
    );
  }

  @Post('stream')
  @ApiOperation({ summary: 'Stream chat completion using Grok AI (POST)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Streamed response with AI-generated content chunks'
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async streamChatCompletion(
    @Body() body: any,
    @Query('message') queryMessage: string,
    @Res() response: Response,
    @Query('model') model?: string,
    @Query('temperature') temperature?: number,
    @Query('systemMessage') systemMessage?: string,
  ): Promise<void> {
    const message = body?.message || queryMessage;
    
    if (!message) {
      response.write(`event: error\ndata: ${JSON.stringify({ 
        content: "No message provided in request body or query parameters.",
        model: "grok-2-latest",
        success: false,
        error: "Missing message"
      })}\n\n`);
      response.end();
      return;
    }
    
    this.logger.log(`Received POST streaming chat request: ${message.substring(0, 50)}...`);
    
    // Set appropriate headers for SSE (Server-Sent Events)
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');  // Important for CORS
    
    // Stream the response
    return this.grokService.streamChatCompletion(
      response,
      message,
      systemMessage,
      model,
      temperature
    );
  }
}