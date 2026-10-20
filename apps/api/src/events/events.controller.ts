import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  EVENT_CHANNELS,
  eventsBatchSchema,
} from '@xplor/shared';

import type { KioskDeviceRequest } from '../kiosks/kiosk-token.guard.js';
import { OptionalKioskTokenGuard } from '../kiosks/optional-kiosk-token.guard.js';
import {
  EventsIngestService,
  type EventsIngestContext,
  type EventsIngestResult,
} from './events-ingest.service.js';
import { EventsRateLimitService } from './events-rate-limit.js';

@Controller('events')
export class EventsController {
  constructor(
    @Inject(EventsIngestService)
    private readonly eventsIngest: EventsIngestService,
    @Inject(EventsRateLimitService)
    private readonly rateLimiter: EventsRateLimitService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalKioskTokenGuard)
  async ingest(
    @Body() body: unknown,
    @Req() request: KioskDeviceRequest,
  ): Promise<EventsIngestResult> {
    const kioskDevice = request.kioskDevice;
    if (kioskDevice === undefined) {
      const clientIp = typeof request.ip === 'string' ? request.ip.trim() : '';
      if (clientIp.length > 0) {
        await this.rateLimiter.consume(clientIp);
      }
    }

    const parsed = eventsBatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: "Lot d'événements invalide",
          details: parsed.error.issues,
        },
        code: 'VALIDATION_ERROR',
        message: "Lot d'événements invalide",
        details: parsed.error.issues,
      });
    }

    const ctx: EventsIngestContext = kioskDevice !== undefined
      ? {
          channel: EVENT_CHANNELS.KIOSK,
          kioskId: kioskDevice.kioskId,
          hotelId: kioskDevice.hotelId,
        }
      : {
          channel: EVENT_CHANNELS.WEB,
        };

    return this.eventsIngest.ingest(parsed.data, ctx);
  }
}
