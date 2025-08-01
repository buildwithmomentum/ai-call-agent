import { Injectable, BadRequestException, HttpStatus, HttpException, Logger } from '@nestjs/common';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import * as path from 'path';
import * as tmp from 'tmp-promise';
import { promises as fs } from 'fs';
import { TranscribeAudioService } from '../transcribe-audio/transcribe-audio.service';

@Injectable()
export class ProcessFileService {
  private readonly logger = new Logger(ProcessFileService.name);
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
  private readonly SUPPORTED_AUDIO_FORMATS = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];

  constructor(private readonly transcribeService: TranscribeAudioService) {}

  /**
   * Processes the file and returns the content.
   */
  public async process(
    file: Express.Multer.File,
    transcriptionService: 'openai' | 'elevenlabs' = 'openai'
  ): Promise<{ data: string | object; status: number }> {
    // Validate file input
    if (!file || !file.buffer || !file.originalname) {
      throw new BadRequestException('Missing or invalid file input');
    }

    const { buffer, originalname, size } = file;

    // File size validation
    if (size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`File ${originalname} exceeds 25MB limit`);
    }

    let cleanup: (() => Promise<void>) | undefined;
    let tempFilePath: string | undefined;

    try {
      // Create temporary directory and file
      const tempDir = await tmp.dir({ 
        unsafeCleanup: true,
        prefix: 'audio-processing-',
        mode: 0o700 // Secure permissions
      });
      
      cleanup = tempDir.cleanup;
      tempFilePath = path.join(tempDir.path, originalname);

      // Write file with error handling
      try {
        await fs.writeFile(tempFilePath, buffer);
      } catch (writeError) {
        throw new HttpException(
          `Failed to write temporary file: ${writeError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Validate file exists after writing
      try {
        await fs.access(tempFilePath);
      } catch (accessError) {
        throw new HttpException(
          'Failed to create temporary file',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      const fileExtension = path.extname(tempFilePath).toLowerCase();
      const output = await this.loadFileContent(tempFilePath, fileExtension, transcriptionService);

      return {
        data: output,
        status: 200,
      };
    } catch (error) {
      this.logger.error(`Error processing file ${originalname}:`, error);
      throw new HttpException(
        error.message || `Failed to process file ${originalname}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    } finally {
      if (cleanup) {
        try {
          await cleanup();
        } catch (cleanupError) {
          this.logger.error(`Error cleaning up temporary files for ${originalname}:`, cleanupError);
        }
      }
    }
  }

  /**
   * Loads the content of the file based on its extension.
   */
  private async loadFileContent(
    filePath: string,
    fileExtension: string,
    transcriptionService: 'openai' | 'elevenlabs' = 'openai'
  ): Promise<string | object> {
    try {
      switch (fileExtension) {
        case '.pdf':
          return new PDFLoader(filePath).load();
        case '.docx':
        case '.doc':
          return new DocxLoader(filePath).load();
        case '.txt':
          return new TextLoader(filePath).load();
        case '.csv':
          return new CSVLoader(filePath).load();
        case '.mp3':
        case '.mp4':
        case '.mpeg':
        case '.mpga':
        case '.m4a':
        case '.wav':
        case '.webm':
          const transcribedText = await this.transcribeService.transcribeAudio(
            filePath,
            transcriptionService
          );
          return [{
            pageContent: transcribedText,
            metadata: {
              source: filePath,
              type: 'audio_transcription',
              service: transcriptionService,
              file_id: path.basename(filePath, fileExtension)
            }
          }];
        default:
          throw new BadRequestException(
            `Unsupported file extension: ${fileExtension}`,
          );
      }
    } catch (error) {
      this.logger.error(`Error loading file content: ${error.message}`, error.stack);
      throw error;
    }
  }
}
