import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from 'src/common/decorators/auth.decorator';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { AuthService } from './auth.service';

interface RequestWithUser extends Request {
  user: any;
  complete_user?: any;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
  ) {}

  

  @Post('register')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'd@d.com' },
        password: { type: 'string', example: 'd@d.com' },
        username: { type: 'string', example: 'john_doe' },        
     
      },
      required: ['email', 'password', 'username', 'phone', 'company', 'title']
    },
  })
  @ApiOperation({ summary: 'Register user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  async register(@Body() body: any) {
    return this.authService.registerUser(body.email, body.password, body.username, body.phone, body.company, body.title);
  }


  @Post('login')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'd@d.com' },
        password: { type: 'string', example: 'd@d.com' },
      },
    },
  })
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user Token',
  })
  async login(@Body() body: any) {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .auth.signInWithPassword({
          email: body.email,
          password: body.password,
        });
      if (error) throw error;
      return {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Updated Get Token Route: Retrieves token from request.user.session if available, otherwise extracts it from headers.
  @Get('token')
  @Auth()
  @ApiOperation({ summary: 'Get current user Token' })
  @ApiResponse({
    status: 200,
    description: 'Returns an object containing the token and its source ("session" if obtained from request.user.session or "header" if extracted from the authorization header).',
  })
  async getAuth(@Req() request: RequestWithUser) {
    let token = '';
    let source = '';
    // Check if token exists in the session
    if (request.user?.session?.access_token) {
      token = request.user.session.access_token;
      source = 'session';
    } else {
      // Fallback: Extract token from the Authorization header.
      const authHeader = request.headers.authorization;
      if (authHeader) {
        token = authHeader.split(' ')[1];
        source = 'header';
      }
    }
    if (!token) {
      return { message: 'Token not found' };
    }
    return { token, source };
  }

  @Get('user')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user information; requires Bearer token in the header.' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user information',
  })
  async getUser(@Req() request: RequestWithUser) {
    return request.user;
  }

  @Post('refresh')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: { type: 'string', example: 'your_refresh_token' },
      },
      required: ['refresh_token'],
    },
  })
  @ApiOperation({ summary: 'Refresh access token using the provided refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Returns the new access token and refresh token',
  })
  async refresh(@Body() body: any) {
    return this.authService.refreshAccessToken(body.refresh_token);
  }
}
