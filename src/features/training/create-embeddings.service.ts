import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
} from 'langchain/text_splitter';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class CreateEmbeddingsService {
  private readonly supabase;
  private readonly logger = new Logger(CreateEmbeddingsService.name);
  private readonly limit: number = 400000;
  private splitter: CharacterTextSplitter | RecursiveCharacterTextSplitter;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = supabaseService.getClient();
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 3000,
      chunkOverlap: 500,
    });
  }
  /**
   * @param data Input data containing content, type, and metadata.
   * @returns 200 on success.
   */
  public async createEmbeddings(data: any): Promise<{ status: number }> {
    if (!data || !data.content) {
      throw new BadRequestException(
        'Invalid data provided for embeddings creation.',
      );
    }

    try {
      const chunks = await this.processDataChunks(data);

      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAPI_KEY,
        batchSize: 48,
      });

      if (data.types === 'file' || data.types === 'website' || data.types === 'audio') {
        await SupabaseVectorStore.fromDocuments(chunks, embeddings, {
          client: this.supabase,
          tableName: data.table,
          queryName: 'match_documents',
        });
      } else {
        const meta = Array(chunks.length).fill({
          user_id: data.userId,
          name: data.name,
          file_id: data.fileId,
        });

        await SupabaseVectorStore.fromTexts(chunks, meta, embeddings, {
          client: this.supabase,
          tableName: data.table,
          queryName: 'match_documents',
        });
      }

      return { status: 200 };
    } catch (error) {
      this.logger.error(`Failed to create embeddings: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to create embeddings: ${error.message}`,
      );
    }
  }
  /**
   * Processes data chunks based on the input type.
   * @returns An array of processed chunks.
   */
  private async processDataChunks(data: any): Promise<any[]> {
    if (!this.splitter) {
      this.splitter =
        data.types === 'file' || data.types === 'website' || data.types === 'audio'
          ? new RecursiveCharacterTextSplitter({
              chunkSize: 3000,
              chunkOverlap: 200,
            })
          : new CharacterTextSplitter({ chunkSize: 3000, chunkOverlap: 500 });
    }

    const chunks =
      data.types === 'file' || data.types === 'website' || data.types === 'audio'
        ? await this.splitter.splitDocuments(data.content)
        : await this.splitter.splitText(data.content);

    if (data.types === 'file' || data.types === 'website' || data.types === 'audio') {
      chunks.forEach((chunk) => {
        if (chunk.metadata) {
          chunk.metadata.file_id = data.fileId;
          
          // Add transcription service info for audio files
          if (data.types === 'audio' && data.transcriptionService) {
            chunk.metadata.transcription_service = data.transcriptionService;
            chunk.metadata.content_type = 'audio_transcription';
          }
          
          if (data.extraInfo) {
            chunk.pageContent += ` \nSource_Title:${data.extraInfo.title} \nSource_URL:${data.extraInfo.link}`;
          }
        }
      });
    }

    return chunks;
  }
}
