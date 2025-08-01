import { Controller, Post, Body } from '@nestjs/common';
import { CallLogsService } from './call-logs.service';
import { CreateCallLogDto } from './dto/create-call-log.dto';

@Controller('call-logs')
export class CallLogsController {
  constructor(private readonly callLogsService: CallLogsService) {}

  @Post()
  async create(@Body() createCallLogDto: CreateCallLogDto) {
    return this.callLogsService.create(createCallLogDto);
  }
}
