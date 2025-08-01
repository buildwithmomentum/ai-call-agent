import {
  Body,
  Controller,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Param,
  Logger,  // Add Logger import
} from '@nestjs/common';
import { TrainingService } from './training.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Auth } from '../../common/decorators/auth.decorator';
import { ApiQuery, ApiParam, ApiBody, ApiResponse, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import * as path from 'path';

@Controller(':voice_agent/training')  
export class TrainingController {
  private readonly logger = new Logger(TrainingController.name);  // Add logger property
  
  constructor(private readonly trainingService: TrainingService) {}

  // Table Name = zz_{voice_agent_id}
  // All the Vector Embeddings will be stored here
  // --> File_Loader -> Markdown Convertion -> Load in Langchain -> Vector Embeddings -> Store in Supabase
  // --> For Chat , Repharsing of the QA ->[Vector Embeddings] -> Supabase Comparison [Table Search Function] --> Answer from LLM

  // --- Website Training Endpoint ---
  @Auth()
  @Post('website')
  @ApiConsumes('application/json')
  @ApiOperation({ summary: 'Initiate website training and process website data for training.' })
  @ApiQuery({
    name: 'type',
    enum: ['website'],
    description: 'Use "website" for website training.',
    required: true,
  })
  @ApiParam({
    name: 'voice_agent',
    description: 'The ID of the voice agent to be trained.',
    required: true,
  })
  @ApiBody({
    description: `JSON payload for website training.
Before using this endpoint, first call the scraping endpoint:
POST http://localhost:3000/scraping/scrape
to obtain the "scrapping_id",  and scraped URLs.
Include "data" (array of URLs) and "scrappingId" .`,
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'string', example: 'https://texagon.io/' },
          description: 'Array of website URLs.',
        },
        scrappingId: {
          type: 'string',
          example: 'eed71bcf-06ef-45c6-9ef0-65fb4d2eeb8c',
          description: 'Unique scraping identifier obtained from scraping endpoint.',
        },
      },
      required: ['data', 'scrappingId'],
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Training initiated successfully for website data.',
    schema: {
      type: 'object',
      properties: {
        msg: { type: 'string', example: 'Training has started' },
        voiceAgentId: { type: 'string', example: 'your-voice-agent-id' },
        scrappingId: { type: 'string', example: 'eed71bcf-06ef-45c6-9ef0-65fb4d2eeb8c' },
      },
    },
  })
  public async websiteTraining(
    @Request() req,
    @Param('voice_agent') voiceAgentId: string,
    @Body() body: any,
  ): Promise<any> {
    if (!voiceAgentId.trim()) {
      throw new HttpException('Invalid voice agent id', HttpStatus.BAD_REQUEST);
    }
    return await this.trainingService.handleSourcesTraining({
      voiceAgentId,
      userId: req.user.id,
      type: 'website',
      content: body,
    });
  }
  
  // --- Text Training Endpoint ---
  @Auth()
  @Post('text')
  @ApiConsumes('application/json')
  @ApiOperation({ summary: 'Initiate text training and process textual content for training.' })
  @ApiQuery({
    name: 'type',
    enum: ['text'],
    description: 'Use "text" for text training.',
    required: true,
  })
  @ApiParam({
    name: 'voice_agent',
    description: 'The ID of the voice agent to be trained.',
    required: true,
  })
  @ApiBody({
    description: 'JSON payload for text training: include "name" and "data" as text.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',  // Changed from array to string
          example: 'Your text content here',
          description: 'Text content for training.',
        },
        name: {
          type: 'string',
          example: 'My Text Document',
          description: 'Name for the text training source.',
        },
      },
      required: ['data', 'name'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Training initiated successfully for text data.',
    schema: {
      type: 'object',
      properties: {
        msg: { type: 'string', example: 'Training has started' },
        voiceAgentId: { type: 'string', example: 'your-voice-agent-id' },
      },
    },
  })
  public async textTraining(
    @Request() req,
    @Param('voice_agent') voiceAgentId: string,
    @Body() body: any,
  ): Promise<any> {
    if (!voiceAgentId.trim()) {
      throw new HttpException('Invalid voice agent id', HttpStatus.BAD_REQUEST);
    }
    return await this.trainingService.handleSourcesTraining({
      voiceAgentId,
      userId: req.user.id,
      type: 'text',
      content: body,
    });
  }

  // --- File Upload Training Endpoint ---
  @Auth()
  @Post('file')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Initiate file training and process file uploads for training.' })
  @ApiQuery({
    name: 'type',
    enum: ['file'],
    description: 'Use "file" for file uploads.',
    required: true,
  })
  @ApiQuery({
    name: 'transcription_service',
    enum: ['openai', 'elevenlabs'],
    description: 'Service to use for audio transcription (optional, defaults to openai)',
    required: false,
  })
  @ApiParam({
    name: 'voice_agent',
    description: 'The ID of the voice agent to be trained.',
    required: true,
  })
  @ApiBody({
    description: 'Multipart/form-data payload for file training. Supports PDF, DOCX, TXT, CSV, and audio files (MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM). Maximum file size: 25MB.',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'File(s) to upload for training. Maximum size: 25MB. Supported formats: PDF, DOCX, TXT, CSV, MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM',
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Training initiated successfully for file uploads.',
    schema: {
      type: 'object',
      properties: {
        msg: { type: 'string', example: 'Training has started' },
        voiceAgentId: { type: 'string', example: 'your-voice-agent-id' },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files'))
  public async fileTraining(
    @Request() req,
    @Param('voice_agent') voiceAgentId: string,
    @UploadedFiles() file: any,
    @Query('transcription_service') transcriptionService: 'openai' | 'elevenlabs' = 'openai'
  ): Promise<any> {
    if (!voiceAgentId.trim()) {
      throw new HttpException('Invalid voice agent id', HttpStatus.BAD_REQUEST);
    }

    return await Promise.all(
      file.map((content: any) =>
        this.trainingService.handleSourcesTraining({
          voiceAgentId,
          userId: req.user.id,
          type: 'file',
          content,
          transcriptionService,
        }),
      ),
    );
  }

  // --- Audio Training Endpoint ---
  @Auth()
  @Post('audio')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Process audio files for training with transcription.' })
  @ApiQuery({
    name: 'transcription_service',
    enum: ['openai', 'elevenlabs'],
    description: 'Service to use for audio transcription.',
    required: true,
  })
  @ApiParam({
    name: 'voice_agent',
    description: 'The ID of the voice agent to be trained.',
    required: true,
  })
  @ApiBody({
    description: 'Multipart/form-data payload for audio training. Supports audio files (MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM). Maximum file size: 25MB.',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Audio file(s) to upload for training. Maximum size: 25MB. Supported formats: MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM',
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Audio transcription and training initiated successfully.',
    schema: {
      type: 'object',
      properties: {
        msg: { type: 'string', example: 'Audio training has started' },
        voiceAgentId: { type: 'string', example: 'your-voice-agent-id' },
        transcription: { 
          type: 'string', 
          example: 'This is the transcribed text from the audio file.',
          description: 'The transcribed text from the audio file.'
        }
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files'))
  public async audioTraining(
    @Request() req,
    @Param('voice_agent') voiceAgentId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('transcription_service') transcriptionService: 'openai' | 'elevenlabs'
  ): Promise<any> {
    this.logger.log(`Audio training requested with ${transcriptionService} service`);
    
    if (!voiceAgentId.trim()) {
      throw new HttpException('Invalid voice agent id', HttpStatus.BAD_REQUEST);
    }

    if (!transcriptionService) {
      throw new HttpException(
        'Transcription service must be specified (openai or elevenlabs)',
        HttpStatus.BAD_REQUEST
      );
    }

    if (!files || files.length === 0) {
      throw new HttpException(
        'No audio files provided. Please upload at least one audio file.',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate each file
    const validAudioExtensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];
    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        throw new HttpException(
          `File ${file.originalname || 'unknown'} is empty or invalid`,
          HttpStatus.BAD_REQUEST
        );
      }

      const fileExtension = path.extname(file.originalname).toLowerCase();
      if (!validAudioExtensions.includes(fileExtension)) {
        throw new HttpException(
          `File ${file.originalname} is not a supported audio format. Please upload MP3, MP4, MPEG, MPGA, M4A, WAV, or WEBM files.`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    return await Promise.all(
      files.map((content: Express.Multer.File) =>
        this.trainingService.handleSourcesTraining({
          voiceAgentId,
          userId: req.user.id,
          type: 'audio',
          content,
          transcriptionService,
        }),
      ),
    );
  }
}
