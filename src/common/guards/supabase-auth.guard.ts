import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase: SupabaseClient;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getPublicClient();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authentication provided');
    }

    if (authHeader.startsWith('Bearer ')) {
      return this.handleJwtAuth(authHeader.split(' ')[1], request);
    } else if (authHeader.startsWith('Basic ')) {
      return this.handleBasicAuth(authHeader.split(' ')[1], request);
    }

    throw new UnauthorizedException('Invalid authentication method');
  }

  private async handleJwtAuth(token: string, request: any): Promise<boolean> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      // Fix: assign session info along with user to request.user so that token is stored in session.
      request.user = { ...user, session: { access_token: token } };
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async handleBasicAuth(
    base64Credentials: string,
    request: any,
  ): Promise<boolean> {
    try {
      const credentials = Buffer.from(base64Credentials, 'base64').toString(
        'ascii',
      );
      const [email, password] = credentials.split(':');

      if (!email || !password) {
        throw new UnauthorizedException('Invalid credentials format');
      }

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      request.user = data.user;
      request.complete_user = data;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
