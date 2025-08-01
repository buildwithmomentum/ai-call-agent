import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { SourceProcessor, TrainingRequestContent, AddWebsiteResult } from './training.interface';
import { HandleStorageService } from './handle-storage.service';
import { ProcessFileService } from './process-file.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { ProcessWebsiteService } from './process-website.service';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);
  private readonly supabase;
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly handleStorage: HandleStorageService,
    private readonly fileProcessor: ProcessFileService,
    private readonly websiteProcessor: ProcessWebsiteService,
  ) {
    this.supabase = supabaseService.getClient();
  }
  /**
   * Handles training files by processing the content or file based on type.
   */
  public async handleSourcesTraining({
    voiceAgentId,
    userId,
    type,
    content,
    transcriptionService = 'openai'
  }: {
    voiceAgentId: string;
    userId: string;
    type: string;
    content: TrainingRequestContent;
    transcriptionService?: 'openai' | 'elevenlabs';
  }): Promise<{ status: string }> {
    try {
      if (!voiceAgentId || !userId || !type) {
        throw new HttpException(
          'Missing required parameters',
          HttpStatus.BAD_REQUEST,
        );
      }

      const sourceProcessor = this.getSourceProcessor(type);

      if (!sourceProcessor) {
        throw new HttpException(
          'Unsupported file type',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await sourceProcessor.process({
        voiceAgentId,
        userId,
        type,
        content,
        transcriptionService, // Add this parameter
      });
    } catch (error) {
      this.logger.error(`Error in handleSourcesTraining: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Retrieves the appropriate processor based on the file type.
   */
  private getSourceProcessor(type: string): SourceProcessor | null {
    switch (type) {
      case 'website':
        return {
          process: this.processWebsiteData.bind(this),
        };
      case 'file':
        return {
          process: this.processFile.bind(this),
        };
      case 'audio':
        return {
          process: this.processAudioFile.bind(this),
        };
      case 'text':
        return {
          process: this.processTextData.bind(this),
        };
      default:
        return null;
    }
  }
  /**
   * Processes YouTube video transcripts.
   */
  private async processWebsiteData({
    voiceAgentId,
    userId,
    type,
    content,
  }: {
    voiceAgentId: string;
    userId: string;
    type: string;
    content?: { data: string[]; scrappingId: string };
  }): Promise<{ msg: string; voiceAgentId: string; scrappingId: string }> {
    try {
      if (!content?.scrappingId || !content?.data) {
        throw new Error(
          'Invalid content: scrappingId or dataSource is missing.',
        );
      }

      const { scrappingId, data } = content;
      const scrappingData =
        await this.websiteProcessor.fetchScrappingData(scrappingId);
      const source = await this.websiteProcessor.filterDataSource(
        scrappingData,
        data,
      );
      const addWebsiteStatusResults =
        await this.websiteProcessor.processWebsites(voiceAgentId, type, source);

      // Updated type guard to handle complete AddWebsiteResult interface with WebsiteData
      const fileIds = addWebsiteStatusResults
        ?.filter((result): result is AddWebsiteResult => 
          result.FileDataID !== null && 
          result.FileDataID !== undefined && 
          result.site !== undefined &&
          'link' in result.site &&
          'title' in result.site &&
          'content' in result.site
        )
        .map(({ FileDataID }) => FileDataID);

      const response = {
        msg: 'Training has started',
        voiceAgentId: voiceAgentId,
        scrappingId: scrappingId,
      };
      await Promise.all([
        this.websiteProcessor.addWebsitesToBot(
          userId,
          voiceAgentId,
          addWebsiteStatusResults,
        ),
        this.handleStorage.updateCustomerSourceLinks(
          userId,
          source?.length ?? 0,
        ),
        this.websiteProcessor.deleteScrappingData(scrappingId),
      ]);
      await this.websiteProcessor.CompanyDataRebaser(voiceAgentId, true, true);

      return response;
    } catch (error) {
      this.logger.error(
        `Error in processWebsiteData: ${(error as Error).message}`,
      );
      throw new HttpException(
        'An error occurred while processing website data.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  /**
   * Processes text data (e.g., converts to embeddings or markdown).
   */
  private async processTextData({
    voiceAgentId,
    userId,
    type,
    content,
  }: {
    voiceAgentId: string;
    userId: string;
    type: string;
    content?: { data: string | string[]; name: string };
  }): Promise<{ msg: string; voiceAgentId: string }> {
    let textRecordId = null;

    try {
      const textRecord = await this.handleStorage.addSourceToDb({
        table: voiceAgentId,
        name: content?.name ?? 'Untitled',
        types: type,
        status: 'training',
        size: content?.data?.length ?? 0,
      });

      textRecordId = textRecord?.id;

      await Promise.all([
        this.handleStorage.saveEmbeddingsDataToDb({
          name: content?.name ?? 'Untitled',
          userId,
          content: content?.data,
          types: type,
          table: voiceAgentId,
          fileId: textRecordId,
        }),
        this.handleStorage.updateCustomerSourceLinks(userId, 1),
        this.handleStorage.updateBotTrainingTime(voiceAgentId),
      ]);

      await this.handleStorage.updateSourceStatusInDb({
        id: textRecordId,
        status: 'done',
      });
      return {
        msg: 'Training has started',
        voiceAgentId: voiceAgentId,
      };
    } catch (error) {
      if (textRecordId) {
        await this.handleStorage.updateSourceStatusInDb({
          id: textRecordId,
          status: 'failed',
        });
      }
      this.logger.error(`Error in processTextFile: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  /**
   * Processes file uploads (e.g., PDF, Word files).
   */
  private async processFile({
    voiceAgentId,
    userId,
    type,
    content,
    transcriptionService = 'openai'
  }: {
    voiceAgentId: string;
    userId: string;
    type: string;
    content?: Express.Multer.File;
    transcriptionService?: 'openai' | 'elevenlabs';
  }): Promise<{ msg: string; voiceAgentId: string }> {
    let fileId: string | null = null;
    try {
      if (!content) {
        throw new HttpException('No file content provided', HttpStatus.BAD_REQUEST);
      }

      const { data } = await this.fileProcessor.process(content, transcriptionService);
      let size = 0;

      if (Array.isArray(data)) {
        data.forEach((obj) => {
          if (typeof obj === 'object' && 'pageContent' in obj) {
            size += (obj.pageContent as string).length;
          }
        });
      } else {
        throw new Error('Data is not an array');
      }

      const fileData = await this.handleStorage.addSourceToDb({
        table: voiceAgentId,
        name: content?.originalname ?? 'UntitledFile.txt',
        types: type,
        status: 'training',
        size,
      });

      fileId = fileData?.id;

      await Promise.all([
        this.handleStorage.saveEmbeddingsDataToDb({
          name: content?.originalname ?? 'UntitledFile.txt',
          userId,
          content: data,
          types: type,
          table: voiceAgentId,
          fileId,
        }),
        this.handleStorage.updateBotTrainingTime(voiceAgentId),
        userId ? this.handleStorage.updateCustomerSourceLinks(userId, 1) : null,
      ]);

      if (fileId) {
        await this.handleStorage.updateSourceStatusInDb({
          id: fileId,
          status: 'done',
        });
      }

      return {
        msg: 'Training has started',
        voiceAgentId: voiceAgentId,
      };
    } catch (error) {
      await this.handleStorage.updateSourceStatusInDb({
        id: fileId,
        status: 'failed',
      });
      this.logger.error(`Error in addFileToBot: ${error.message}`);
      throw new HttpException(
        'An error occurred while cleaning up the temporary directory.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Processes audio file uploads with transcription.
   */
  private async processAudioFile({
    voiceAgentId,
    userId,
    type,
    content,
    transcriptionService,
  }: {
    voiceAgentId: string;
    userId: string;
    type: string;
    content?: Express.Multer.File;
    transcriptionService: 'openai' | 'elevenlabs';
  }): Promise<{ msg: string; voiceAgentId: string; transcription?: string }> {
    let fileId: string | null = null;
    try {
      if (!content) {
        throw new HttpException('No audio file content provided', HttpStatus.BAD_REQUEST);
      }

      if (!transcriptionService) {
        throw new HttpException('Transcription service must be specified', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Processing audio file: ${content.originalname} using ${transcriptionService}`);
      
      const { data } = await this.fileProcessor.process(content, transcriptionService);
      let size = 0;
      let transcription = '';

      if (Array.isArray(data)) {
        data.forEach((obj) => {
          if (typeof obj === 'object' && 'pageContent' in obj) {
        size += (obj.pageContent as string).length;
        // Store the transcription text
        transcription = obj.pageContent as string;
          }
        });
      } else {
        throw new HttpException('Data is not an array', HttpStatus.BAD_REQUEST);
      }

      const fileData = await this.handleStorage.addSourceToDb({
        table: voiceAgentId,
        name: content?.originalname ?? 'UntitledAudio.mp3',
        types: 'audio', // Specific type for audio
        status: 'training',
        size,
      });

      fileId = fileData?.id;

      await Promise.all([
        this.handleStorage.saveEmbeddingsDataToDb({
          name: content?.originalname ?? 'UntitledAudio.mp3',
          userId,
          content: data,
          types: 'audio',
          table: voiceAgentId,
          fileId,
          transcriptionService, // Pass the transcription service info
        }),
        this.handleStorage.updateBotTrainingTime(voiceAgentId),
        userId ? this.handleStorage.updateCustomerSourceLinks(userId, 1) : null,
      ]);

      if (fileId) {
        await this.handleStorage.updateSourceStatusInDb({
          id: fileId,
          status: 'done',
        });
      }

      return {
        msg: 'Audio training has started',
        voiceAgentId: voiceAgentId,
        transcription: transcription // Include transcription in response
      };
    } catch (error) {
      await this.handleStorage.updateSourceStatusInDb({
        id: fileId,
        status: 'failed',
      });
      this.logger.error(`Error in processAudioFile: ${error.message}`);
      throw new HttpException(
        'An error occurred while processing the audio file.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
