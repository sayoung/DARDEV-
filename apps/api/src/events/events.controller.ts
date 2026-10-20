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

@Controller('events')
export class EventsController {
  constructor(
    @Inject(EventsIngestService)
    private readonly eventsIngest: EventsIngestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalKioskTokenGuard)
  ingest(
    @Body() body: unknown,
    @Req() request: KioskDeviceRequest,
  ): Promise<EventsIngestResult> {
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

    const kioskDevice = request.kioskDevice;
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
