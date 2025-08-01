import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HandleStorageService } from './handle-storage.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { AddWebsiteResult, WebsiteData } from './training.interface';
import { Document } from '@langchain/core/documents';
import { SummaryService } from './summary.service';
import { BusinessService } from '../../features/business/business.service'; // <-- new import

@Injectable()
export class ProcessWebsiteService {
  private readonly supabase;
  private readonly logger = new Logger(ProcessWebsiteService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly handleStorage: HandleStorageService,
    private readonly summary: SummaryService,
    private readonly businessService: BusinessService, // <-- new dependency
  ) {
    this.supabase = supabaseService.getClient();
  }
  /**
   * Fetches website scraping data from Supabase.
   */
  public async fetchScrappingData(scrappingId: string): Promise<WebsiteData[]> {
    const { data, error } = await this.supabase
      .from('scrapping_data')
      .select('*')
      .eq('id', scrappingId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Error fetching scrapping data for ID: ${scrappingId}`,
        error,
      );
      throw new HttpException(
        'Error fetching scrapping data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!data) {
      this.logger.warn(`Scrapping data not found for ID: ${scrappingId}`);
      throw new HttpException(
        'Scrapping data not found. Please verify that the scrapping ID is valid, that the scraping process completed successfully, or that the data might have already been trained on.',
        HttpStatus.NOT_FOUND,
      );
    }

    return data?.data;
  }
  /**
   * Rebases company data by generating and saving a summary.
   * @returns The summary data.
   */
  public async CompanyDataRebaser(
    voiceAgentId: string,
    optimizer: boolean = true,
    pushUpdate: boolean = true,
  ): Promise<any> {
    try {
      const Summary = await this.summary.generateSummary(voiceAgentId, optimizer);
      const data = {
        summary: Summary?.summary,
        token_cost: Summary?.tokenCost.cost,
        inputTokens: Summary?.tokenCost.tokens.input,
        outputTokens: Summary?.tokenCost.tokens.output,
        last_updated: new Date().toISOString(),
      };
      if (pushUpdate) {
        // Update voice_agents summary
        await this.supabase
          .from('voice_agents')
          .update({ summary: data })
          .eq('id', voiceAgentId);

        // Check if a business already exists for the voice agent
        const { data: businessRecord } = await this.supabase
          .from('business_details')
          .select('id')
          .eq('voice_agent_id', voiceAgentId)
          .maybeSingle();

        if (businessRecord) {
          // If exists, update the business_summary field
          await this.supabase
            .from('business_details')
            .update({ business_summary: Summary?.summary })
            .eq('voice_agent_id', voiceAgentId);
        } else {
          // If not exists, create a new business with default values
          await this.businessService.create({
            voice_agent_id: voiceAgentId,
            business_name: "Default Business",
            business_phone: "N/A",
            type_of_business: "N/A",
            business_summary: Summary?.summary,
            operating_schedule: {} // or set default schedule as needed
          });
        }
      }
      return data;
    } catch (error) {
      this.logger.error(
        `Error rebasing company data for voice_agent ID: ${voiceAgentId}`,
        error,
      );
      throw new HttpException(
        'Error rebasing company data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  /**
   * Filters the scrapping data based on the provided data source.
   */
  public async filterDataSource(
    scrappingData: WebsiteData[],
    dataSource: string[] | undefined,
  ): Promise<WebsiteData[]> {
    if (!dataSource || dataSource.length === 0) {
      return scrappingData;
    }

    return scrappingData?.filter((site) =>
      dataSource.some((ds: any) =>
        typeof ds === 'string' ? ds === site?.link : ds?.link === site?.link,
      ),
    );
  }
  /**
   * Processes websites for a given voice_agent.
   */
  public async processWebsites(
    voiceAgentId: string,
    type: string,
    source: WebsiteData[],
  ): Promise<AddWebsiteResult[]> {
    if (!source || source.length === 0) {
      return [];
    }

    const results = await Promise.all(
      source?.map(async (site) => {
        const FileDataID = await this.handleStorage.addSourceToDb({
          table: voiceAgentId,
          name: site?.title,
          types: type,
          status: 'training',
          size: site?.size,
          url: site?.link,
        });
        return { FileDataID, site };
      }),
    );
    return results?.filter(({ FileDataID }) => FileDataID);
  }

  /**
   * Deletes scraping data for the provided ID.
   */
  public async deleteScrappingData(scrappingId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('scrapping_data')
        .delete()
        .eq('id', scrappingId);

      if (error) {
        this.logger.error(`Error deleting scraping data: ${error.message}`);
        throw new Error(`Error deleting scraping data: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Error in deleteScrappingData: ${(error as Error).message}`,
      );
      throw new Error(
        `Error in deleteScrappingData: ${(error as Error).message}`,
      );
    }
  }
  /**
   * Adds websites to a bot.
   */
  public async addWebsitesToBot(
    userId: string,
    voiceAgentId: string,
    results: AddWebsiteResult[],
  ): Promise<void> {
    await Promise.all(
      results?.map(async ({ FileDataID, site }) => {
        if (FileDataID) {
          await this.addWebsiteToBot(
            userId,
            voiceAgentId,
            site?.title,
            site?.content,
            FileDataID,
            site,
          );
        }
      }),
    );
  }
  /**
   * Adds a single website to a bot.
   */
  private async addWebsiteToBot(
    userId: string,
    voiceAgentId: string,
    name: string,
    data: string,
    fileDataId: any,
    site: { link: string; title: string },
  ): Promise<void> {
    try {
      const convertedData = new Document({
        pageContent: data,
        metadata: {
          source: site.link,
        },
      });

      await this.handleStorage.saveEmbeddingsDataToDb({
        name,
        userId,
        content: [convertedData],
        types: 'website',
        table: voiceAgentId,
        fileId: fileDataId,
        extraInfo: {
          title: site.title,
          link: site.link,
        },
      });

      await Promise.all([
        this.handleStorage.updateSourceStatusInDb({
          id: fileDataId?.id,
          status: 'done',
        }),
        this.handleStorage.updateBotTrainingTime(voiceAgentId),
      ]);
    } catch (error) {
      await this.handleStorage.updateSourceStatusInDb({
        id: fileDataId,
        status: 'failed',
      });
      this.logger.error(
        `Error in addWebsiteToBot: ${(error as Error).message}`,
      );
      throw new Error(`Error in addWebsiteToBot: ${(error as Error).message}`);
    }
  }
}
