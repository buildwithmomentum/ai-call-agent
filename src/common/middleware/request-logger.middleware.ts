import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  constructor() {}
  
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;
    res.on('finish', () => {
      const responseTime = Date.now() - start;
      const statusCode = res.statusCode;
      this.logger.debug(
        `${method} ${originalUrl} ${statusCode} ${responseTime}ms`
      );
    });
    
    next();
  }
} 