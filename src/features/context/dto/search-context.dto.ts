import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchContextDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The ID of the voice agent', example: 'voice-agent-123' })
  voiceAgentId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Search term for embeddings', example: 'How to reset password?' })
  query: string;
}
