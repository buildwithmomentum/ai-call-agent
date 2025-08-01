import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBasicAuth,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';

export function Auth() {
  return applyDecorators(
    UseGuards(SupabaseAuthGuard),
    ApiSecurity('Authorization'),
    ApiBasicAuth('basic'),
    ApiBasicAuth('apiKey'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid credentials or token',
    }),
  );
}
