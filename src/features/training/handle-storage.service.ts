import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { CreateEmbeddingsService } from './create-embeddings.service';

@Injectable()
export class HandleStorageService {
  private readonly supabase;
  private readonly logger = new Logger(HandleStorageService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly createEmbeddings: CreateEmbeddingsService,
  ) {
    this.supabase = supabaseService.getClient();
  }
  /**
   * Adds source data to the database (sources table).
   */
  public async addSourceToDb({
    table,
    name,
    types,
    status,
    size,
    url,
  }: {
    table: string;
    name: string;
    types: string;
    status: string;
    size: string | number;
    url?: string;
  }): Promise<any> {
    try {
      const { data: userData, error: userError } = await this.supabase
        .from('sources')
        .insert([
          {
            voice_agent_id: table,
            name: name,
            source_type: types,
            status: status,
            size: size,
            url: url ?? null,
          },
        ])
        .select('id')
        .maybeSingle();

      if (userError) {
        throw new Error(`Error in addTextToDb: ${userError.message}`);
      }

      return userData;
    } catch (error) {
      this.logger.error(`Error adding source to database: ${error.message}`);
      throw new HttpException(
        'Error adding text to database',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  /**
   * Ensures the embeddings table exists before saving data
   */
  private async ensureEmbeddingsTable(tableId: string): Promise<void> {
    try {
      await this.supabase.rpc('create_embeddings_table', { table_id: tableId });
    } catch (error) {
      this.logger.error(`Error ensuring embeddings table exists: ${error.message}`);
      throw error;
    }
  }

  /**
   * Saves data to Supabase, creates embeddings, and handles different content types.
   */
  public async saveEmbeddingsDataToDb(data: any): Promise<any> {
    try {
      const tableId = `zz_${data.table}`;
      
      // Ensure the table exists before trying to insert data
      await this.ensureEmbeddingsTable(tableId);

      if (data.types === 'file' || data.types === 'website') {
        await this.createEmbeddings.createEmbeddings({
          ...data,
          table: tableId,
        });
      } else {
        const chunkSize = 24000;

        for (let i = 0; i < data?.content?.length; i += chunkSize) {
          const chunk = data?.content?.slice(i, i + chunkSize);
          await this.createEmbeddings.createEmbeddings({
            ...data,
            content: chunk,
            table: tableId,
          });
        }
      }

      return data ? data[0] : null;
    } catch (error) {
      this.logger.error(
        `Error creating embeddings in DataSource: ${error.message}`,
      );
      throw new HttpException(
        'Error creating embeddings in DataSource.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  /**
   * Updates the status of a file in the database.
   */
  public async updateSourceStatusInDb({
    id,
    status,
  }: {
    id: string | null;
    status: string;
  }): Promise<any> {
    try {
      if (!id) return;
      const { error } = await this.supabase
        .from('sources')
        .update({ status: status })
        .eq('id', id);

      if (error) {
        throw new Error(`Error in updateSourceStatusInDb: ${error.message}`);
      }

      return id ? id : null;
    } catch (error) {
      this.logger.error(`Error in updateSourceStatusInDb: ${error.message}`);
      throw new Error(`Error in updateSourceStatusInDb: ${error.message}`);
    }
  }
  /**
   * Updates the bot's training timestamp.
   */
  public async updateBotTrainingTime(voiceAgentId: string): Promise<void> {
    await this.supabase
      .from('voice_agents')
      .update({ last_trained_at: 'now()' })
      .eq('id', voiceAgentId);
  }

  /**
   * Updates the customer's source links allowance.
   */
  public async updateCustomerSourceLinks(
    userId: string,
    usedLinks: number,
  ): Promise<void> {
    try {
      const { data: customer, error: selectError } = await this.supabase
        .from('customer')
        .select('source_links_allowed')
        .eq('uuid', userId)
        .maybeSingle();

      if (selectError || !customer) {
        this.logger.error(
          `Error fetching customer or customer not found: ${selectError?.message}`,
        );
        return;
      }

      const links = Math.max(0, customer.source_links_allowed - usedLinks);
      const { error: updateError } = await this.supabase
        .from('customer')
        .update({ source_links_allowed: links })
        .eq('uuid', userId);

      if (updateError) {
        this.logger.error(
          `Error updating source_links_allowed: ${updateError.message}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error in updateCustomerSourceLinks: ${error.message}`);
      throw new Error(`Error in updateCustomerSourceLinks: ${error.message}`);
    }
  }
}
