import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Get,
  Query,
  Res,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { ScrapingService } from './scraping.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { ScrapeWebsitesDto } from './dto/scrape-websites.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';

@ApiTags('Scraping')
@Controller('scraping')
export class ScrapingController {
  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Auth()
  @Post('scrape')
  @ApiOperation({ summary: 'Scrape content from multiple websites' })
  @ApiResponse({
    status: 200,
    description: 'Websites scraped successfully',
    schema: {
      properties: {
        message: { type: 'string', example: 'Websites scraped successfully' },
        scrapping_id: { type: 'string', example: 'abc123' },
        count: { type: 'number', example: 2 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async scrapeWebsites(@Body() body: ScrapeWebsitesDto, @Req() req) {
    try {
      const { urls } = body;
      const userid = req.user.id;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        throw new HttpException(
          'Invalid URLs provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      const scrapedData = await this.scrapingService.scrapeMultipleUrls(urls);

      const { data } = await this.supabaseService
        .getClient()
        .from('scrapping_data')
        .insert({
          user_id: userid,
          data: scrapedData,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      return {
        message: 'Websites scraped successfully',
        scrapping_id: data?.id,
        count: scrapedData.length,
        scraped_urls: scrapedData.map(item => item.link) // new property with scraped URLs
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to scrape websites',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // @Get(':scrapping_id')
  // async getScrapedData(@Param('scrapping_id') scrappingId: string) {
  //   try {
  //     const { data, error } = await this.supabaseService
  //       .getClient()
  //       .from('scrapping_data')
  //       .select('data')
  //       .eq('id', scrappingId)
  //       .single();
  //     if (error) throw error;
  //     return data;
  //   } catch (error) {
  //     throw new HttpException(
  //       error.message || 'Failed to fetch data',
  //       error.status || HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  private sendEvent(response: Response, eventType: string, data: any) {
    response.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  @Auth()
  @Get()
  @ApiOperation({ summary: 'Scan and process all URLs from a given webpage' })
  @ApiResponse({
    status: 200,
    description: 'URLs scanned and processed successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid URL provided'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  async scanUrlProgress(
    @Query('url') fullUrl: string,
    @Res() response: Response,
    @Req() req,
  ) {
    try {
      if (!fullUrl) {
        throw new HttpException('Invalid URL provided', HttpStatus.BAD_REQUEST);
      }

      const userid = req.user.id; 

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const urls = await this.scrapingService.getAllUrlsFromPage(fullUrl);
      const cleanUrl = (str: string) => {
        str = str.replace(/(https?:\/\/)|(\/\/+)/g, (match) =>
          match.startsWith('http') ? match : '/',
        );
        return str.replace(/\/+$/, '');
      };
      const uniqueUrls = Array.from(
        new Set(
          urls.map((url) => {
            if (url.startsWith('http')) {
              try {
                const urlObj = new URL(url);
                return cleanUrl(urlObj.pathname);
              } catch (e) {
                return cleanUrl(url);
              }
            }
            const pathWithoutHash = url.split('#')[0];
            const cleanPath = cleanUrl(pathWithoutHash);
            return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
          }),
        ),
      );

      const processableUrls = uniqueUrls.map((path) =>
        path.startsWith('http') ? path : cleanUrl(`${fullUrl}${path}`),
      );

      this.sendEvent(response, 'init', {
        total: processableUrls.length,
        urls: processableUrls,
      });

      const concurrentLimit = 5;
      let processed = 0;

      const processQueue = async () => {
        const active = new Set();
        const results = [];

        const processUrl = async (index: number) => {
          if (index >= processableUrls.length) return;

          const processedUrl = processableUrls[index];
          try {
            const result =
              await this.scrapingService.scrapeWebsite(processedUrl);
            results[index] = result;
            processed++;
            // Deep Copy + remove content
            const temp_response = JSON.parse(JSON.stringify(result));
            delete temp_response.content;
            this.sendEvent(response, 'url_processed', {
              processed,
              total: processableUrls.length,
              results: [temp_response],
            });

            active.delete(index);
            const nextIndex = index + concurrentLimit;
            if (nextIndex < processableUrls.length) {
              active.add(nextIndex);
              await processUrl(nextIndex);
            }
          } catch (error) {
            console.error(`Error processing URL ${processedUrl}:`, error);
            results[index] = { error: error.message };
            active.delete(index);
          }
        };

        const initialBatch = processableUrls
          .slice(0, concurrentLimit)
          .map((_, index) => {
            active.add(index);
            return processUrl(index);
          });

        await Promise.all(initialBatch);
        return results;
      };

      const results = (await processQueue()) as {
        title: string;
        content: string;
        link: string;
        size: number;
        isCSR: boolean;
      }[];

      const { data } = await this.supabaseService
        .getClient()
        .from('scrapping_data')
        .insert({
          user_id: userid, 
          data: results,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      this.sendEvent(response, 'req_completed', {
        total: processableUrls.length,
        results: results.map((result) => {
          delete result.content;
          return result;
        }),
        scrapping_id: data?.id,
      });

      this.sendEvent(response, 'complete', { message: 'Scanning complete' });
      response.end();
    } catch (error) {
      this.sendEvent(response, 'error', { message: error.message });
      response.end();
    }
  }
}
