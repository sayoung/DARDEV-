import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  eventsBatchSchema,
  type EventChannel,
  type EventsBatch,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';

const MILLISECONDS_IN_HOUR = 60 * 60 * 1000;
const MILLISECONDS_IN_DAY = 24 * MILLISECONDS_IN_HOUR;
const MAX_FUTURE_WINDOW_MS = 24 * MILLISECONDS_IN_HOUR;
const MAX_PAST_WINDOW_MS = 7 * MILLISECONDS_IN_DAY;

export interface EventsIngestContext {
  channel: EventChannel;
  kioskId?: string;
  hotelId?: string;
}

export interface EventsIngestResult {
  accepted: number;
}

export interface EventsIngestPrismaClient {
  event: {
    createMany(args: {
      data: Prisma.EventCreateManyInput[];
    }): Promise<Prisma.BatchPayload>;
  };
}

@Injectable()
export class EventsIngestService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: EventsIngestPrismaClient,
  ) {}

  /**
   * Ingère un lot d'événements statistiques (F-80, API-04).
   * - Reparse le lot avec eventsBatchSchema de @xplor/shared.
   * - Force le canal, kioskId et hotelId depuis le contexte vérifié.
   * - Rejette avec BadRequestException si un événement a un occurredAt plus de 24h dans le futur.
   * - Ignore sans erreur les événements ayant un occurredAt de plus de 7 jours dans le passé.
   * - Insère les événements retenus via prisma.event.createMany (ou saute l'appel si aucun événement).
   * - Ne stocke aucune adresse IP ni aucun en-tête (loi 09-08, NF-02).
   */
  async ingest(
    batch: EventsBatch,
    ctx: EventsIngestContext,
    now: Date = new Date(),
  ): Promise<EventsIngestResult> {
    const parseResult = eventsBatchSchema.safeParse(batch);
    if (!parseResult.success) {
      throw new BadRequestException("Lot d'événements invalide");
    }

    const validatedBatch = parseResult.data;
    const nowTime = now.getTime();

    // Rejet du lot avec une BadRequestException si un occurredAt est à plus de 24 h dans le futur
    for (const event of validatedBatch.events) {
      const eventTime = new Date(event.occurredAt).getTime();
      if (eventTime - nowTime > MAX_FUTURE_WINDOW_MS) {
        throw new BadRequestException(
          "Un ou plusieurs événements possèdent une date située à plus de 24 heures dans le futur",
        );
      }
    }

    // Ignorer sans erreur les événements de plus de 7 jours dans le passé
    const validEvents = validatedBatch.events.filter((event) => {
      const eventTime = new Date(event.occurredAt).getTime();
      return nowTime - eventTime <= MAX_PAST_WINDOW_MS;
    });

    // Sauter l'appel à createMany s'il n'y a aucun événement retenu
    if (validEvents.length === 0) {
      return { accepted: 0 };
    }

    const rowsToInsert: Prisma.EventCreateManyInput[] = validEvents.map(
      (event): Prisma.EventCreateManyInput => ({
        channel: ctx.channel,
        kioskId: ctx.kioskId ?? null,
        hotelId: ctx.hotelId ?? null,
        sessionId: event.sessionId,
        type: event.type,
        tourId: event.tourId ?? null,
        sceneId: event.sceneId ?? null,
        hotspotId: event.hotspotId ?? null,
        lang: event.lang,
        durationMs: event.durationMs ?? null,
        occurredAt: new Date(event.occurredAt),
      }),
    );

    await this.prisma.event.createMany({
      data: rowsToInsert,
    });

    return { accepted: validEvents.length };
  }
}
