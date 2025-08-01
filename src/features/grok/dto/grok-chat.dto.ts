import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class GrokChatDto {
  @ApiProperty({
    description: 'The text prompt to send to the Grok model',
    example: 'What is artificial intelligence?'
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Instructions for the AI\'s behavior',
    default: 'You are a helpful assistant.',
    example: 'You are a helpful assistant specialized in AI topics.'
  })
  @IsString()
  @IsOptional()
  systemMessage?: string;

  @ApiPropertyOptional({
    description: 'The Grok model to use',
    default: 'grok-1'
  })
  @IsString()
  @IsOptional()
  modelName?: string;

  @ApiPropertyOptional({
    description: 'Controls randomness (0-1)',
    default: 0.7,
    minimum: 0,
    maximum: 1
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Maximum tokens in the response',
    default: 1024
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;
} 