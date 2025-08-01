import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiUnauthorizedResponse } from '@nestjs/swagger';
import { OriginCheckGuard } from '../guards/origin-check.guard';

export function OriginCheck() {
  return applyDecorators(
    UseGuards(OriginCheckGuard),
    ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid origin' }),
  );
}
