import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class OriginCheckGuard implements CanActivate {
  private readonly logger = new Logger(OriginCheckGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const origin = request.headers.origin;
    const referer = request.headers.referer;

    // Add logging for debugging
    this.logger.debug(`Origin Check Guard - Origin: ${origin}, Referer: ${referer}`);

    // Updated allowed origin conditions
    const isValidOrigin =
      origin &&
      (origin.includes('operator-backend-stage.buildaierc.com') || 
       origin.includes('build-operatorai-frontend-production.up.railway.app') ||
       origin.includes('localhost') ||
       origin.includes('127.0.0.1') ||
       origin.includes('operator-ai-alpha.vercel.app') ||
       origin.includes('operator-ai-v1.vercel.app'));
    const isValidReferer =
      referer &&
      (referer.includes('operator-backend-stage.buildaierc.com') || 
       referer.includes('build-operatorai-frontend-production.up.railway.app') ||
       referer.includes('localhost') ||
       referer.includes('127.0.0.1') ||
       referer.includes('operator-ai-alpha.vercel.app') ||
       referer.includes('operator-ai-v1.vercel.app'));

    this.logger.debug(`Origin Check Guard - isValidOrigin: ${isValidOrigin}, isValidReferer: ${isValidReferer}`);

    if (isValidOrigin || isValidReferer) {
      return true;
    }

    this.logger.warn(`Origin Check Guard - BLOCKING REQUEST. Origin: ${origin}, Referer: ${referer}`);
    throw new UnauthorizedException('Unauthorized origin');
  }
}
