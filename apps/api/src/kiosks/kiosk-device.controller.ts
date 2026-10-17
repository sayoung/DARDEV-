import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  KioskEnrollRequestSchema,
  type KioskEnrollResponse,
} from '@xplor/shared';
import type { FastifyRequest } from 'fastify';

import { parseBody } from '../catalog/catalog-http.js';
import { KioskService } from './kiosks.service.js';

const TEN_PER_MINUTE = { default: { limit: 10, ttl: 60_000 } };

@Controller('kiosk')
export class KioskDeviceController {
  constructor(@Inject(KioskService) private readonly kiosks: KioskService) {}

  @Post('enroll')
  @HttpCode(HttpStatus.OK)
  @Throttle(TEN_PER_MINUTE)
  @UseGuards(ThrottlerGuard)
  enroll(@Body() body: unknown, @Req() request: FastifyRequest): Promise<KioskEnrollResponse> {
    const input = parseBody(KioskEnrollRequestSchema, body);
    return this.kiosks.enroll(input, request.ip || null);
  }
}
