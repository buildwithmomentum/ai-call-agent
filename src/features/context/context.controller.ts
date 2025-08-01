import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContextService } from './context.service';
import { SearchContextDto } from './dto/search-context.dto';

@ApiTags('Context')
@Controller('context')
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  @Post()
  @ApiOperation({ summary: 'Search embeddings context by query string. This route converts the query into an embedding and retrieves matching context from the knowledge base.' })
  @ApiResponse({ status: 200, description: 'List of contexts based on the search term', schema: { example: [{ context: 'Sample context snippet' }] } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  public async searchContext(@Body() searchContextDto: SearchContextDto): Promise<any> {
    const { voiceAgentId, query } = searchContextDto;
    if (!voiceAgentId || !query) {
      throw new HttpException('voice_agent and query parameters are required', HttpStatus.BAD_REQUEST);
    }
    const results = await this.contextService.searchEmbeddings(voiceAgentId, query);
    return results.map((result: any) => ({ context: result.pageContent }));
  }
}
