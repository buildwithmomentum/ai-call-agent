import {
  IsArray,
  IsNotEmpty,
  ArrayMinSize,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScrapeWebsitesDto {
  @ApiProperty({
    description: 'Array of URLs to scrape',
    example: ['https://texagon.io/'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one URL must be provided' })
  @IsUrl({}, { each: true, message: 'Each URL must be a valid URL' })
  urls: string[];
}
