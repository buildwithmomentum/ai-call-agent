import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SourceService } from './source.service';
import {
  Source,
  SourceCreateDTO,
  SourceUpdateDTO,
  SourceStatusUpdateDTO,
} from '../../Models/source.model';

@Controller('voice_agents/:voice_agent_id/sources')
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @Get()
  public async getSource(
    @Param('voice_agent_id') voiceAgentId: string,
  ): Promise<Source[]> {
    try {
      const sources = await this.sourceService.getSources(voiceAgentId);
      if (!sources || sources.length === 0) {
        return [];
      }
      return sources;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  public async getSourceById(
    @Param('voice_agent_id') voiceAgentId: string,
    @Param('id') sourceId: string,
  ): Promise<Source> {
    try {
      const source = await this.sourceService.getSource(sourceId);
      if (!source || source.voice_agent_id !== voiceAgentId) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }
      return source;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  public async createSource(
    @Param('voice_agent_id') voiceAgentId: string,
    @Body() sourceData: SourceCreateDTO,
  ): Promise<Source> {
    try {
      return await this.sourceService.createSource(sourceData, voiceAgentId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  public async updateSource(
    @Param('voice_agent_id') voiceAgentId: string,
    @Param('id') sourceId: string,
    @Body() sourceData: SourceUpdateDTO,
  ): Promise<Source> {
    try {
      const source = await this.sourceService.getSource(sourceId);
      if (!source || source.voice_agent_id !== voiceAgentId) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }
      return await this.sourceService.updateSource(
        sourceId,
        sourceData,
        voiceAgentId,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  public async deleteSource(
    @Param('voice_agent_id') voiceAgentId: string,
    @Param('id') sourceId: string,
  ): Promise<void> {
    try {
      const source = await this.sourceService.getSource(sourceId);
      if (!source || source.voice_agent_id !== voiceAgentId) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }
      await this.sourceService.deleteSource(sourceId, voiceAgentId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/status')
  public async getSourceStatus(
    @Param('voice_agent_id') voiceAgentId: string,
    @Param('id') sourceId: string,
  ): Promise<{ status: string }> {
    try {
      const source = await this.sourceService.getSource(sourceId);
      if (!source || source.voice_agent_id !== voiceAgentId) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }
      return {
        status: source.status,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id/status')
  public async updateSourceStatus(
    @Param('voice_agent_id') voiceAgentId: string,
    @Param('id') sourceId: string,
    @Body() statusData: SourceStatusUpdateDTO,
  ): Promise<Source> {
    try {
      const source = await this.sourceService.getSource(sourceId);
      if (!source || source.voice_agent_id !== voiceAgentId) {
        throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
      }
      return await this.sourceService.updateSourceStatus(
        sourceId,
        statusData,
        voiceAgentId,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
