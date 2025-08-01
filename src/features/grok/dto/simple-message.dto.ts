import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SimpleMessageDto {
  @ApiProperty({
    description: 'The text prompt to send to the Grok model',
    example: 'What is artificial intelligence?'
  })
  @IsString()
  @IsNotEmpty()
  message: string;
} 