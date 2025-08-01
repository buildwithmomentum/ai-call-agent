import { ApiProperty } from '@nestjs/swagger';

export class GetBookedSlotsDto {
  @ApiProperty({ description: 'Voice agent ID', example: '92bb944f-032e-44c0-8f73-0acb7527bd45' })
  voice_agent_id: string;

  @ApiProperty({ description: 'Date to check (YYYY-MM-DD)', example: '2025-03-05' })
  date: string;
}
