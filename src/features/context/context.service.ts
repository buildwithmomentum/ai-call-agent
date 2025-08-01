import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Searches embeddings for a given voice_agent using a query string.
   */
  public async searchEmbeddings(
    voiceAgentId: string,
    query: string,
    matchCount: number = 1,
  ): Promise<any[]> {
    try {
      const tableName = `zz_${voiceAgentId}`;
      const supabaseClient = this.supabaseService.getClient();
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAPI_KEY,
      });

      const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
        client: supabaseClient,
        tableName,
        queryName: `${tableName}_search`,
      });

      const results = await vectorStore.similaritySearch(query, matchCount);
      return results;
    } catch (error) {
      this.logger.error(`Error searching embeddings: ${error.message}`);
      throw new HttpException('Error searching embeddings', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
