import 'reflect-metadata';

import { BadRequestException, HttpStatus } from '@nestjs/common';
import {
  EVENT_CHANNELS,
  EVENT_TYPES,
  type Event,
  type EventsBatch,
} from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  KioskDevice,
  KioskDeviceRequest,
} from '../kiosks/kiosk-token.guard.js';
import { OptionalKioskTokenGuard } from '../kiosks/optional-kiosk-token.guard.js';
import { EventsController } from './events.controller.js';
import {
  EventsIngestService,
  type EventsIngestContext,
  type EventsIngestPrismaClient,
  type EventsIngestResult,
} from './events-ingest.service.js';

const dummyPrismaClient: EventsIngestPrismaClient = {
  event: {
    createMany: () => Promise.resolve({ count: 0 }),
  },
};

interface RecordedIngestCall {
  batch: EventsBatch;
  ctx: EventsIngestContext;
}

class MockEventsIngestService extends EventsIngestService {
  public calls: RecordedIngestCall[] = [];
  public result: EventsIngestResult = { accepted: 1 };

  constructor() {
    super(dummyPrismaClient);
  }

  override ingest(
    batch: EventsBatch,
    ctx: EventsIngestContext,
  ): Promise<EventsIngestResult> {
    this.calls.push({ batch, ctx });
    return Promise.resolve(this.result);
  }
}

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    sessionId: overrides.sessionId ?? '01990000-0000-7000-8000-000000000001',
    type: overrides.type ?? EVENT_TYPES.SESSION_START,
    channel: overrides.channel ?? EVENT_CHANNELS.KIOSK,
    tourId:
      overrides.tourId === undefined
        ? '01990000-0000-7000-8000-000000000002'
        : overrides.tourId,
    sceneId:
      overrides.sceneId === undefined
        ? '01990000-0000-7000-8000-000000000003'
        : overrides.sceneId,
    hotspotId:
      overrides.hotspotId === undefined
        ? '01990000-0000-7000-8000-000000000004'
        : overrides.hotspotId,
    lang: overrides.lang ?? 'fr',
    durationMs:
      overrides.durationMs === undefined ? 1500 : overrides.durationMs,
    occurredAt: overrides.occurredAt ?? '2026-10-20T12:00:00.000Z',
  };
}

function isKioskDeviceRequest(value: unknown): value is KioskDeviceRequest {
  return typeof value === 'object' && Boolean(value);
}

function makeRequest(device?: KioskDevice): KioskDeviceRequest {
  const requestObject = { kioskDevice: device };
  if (isKioskDeviceRequest(requestObject)) {
    return requestObject;
  }
  throw new Error('Type guard KioskDeviceRequest invalide');
}

describe('EventsController', () => {
  let service: MockEventsIngestService;
  let controller: EventsController;

  beforeEach(() => {
    service = new MockEventsIngestService();
    controller = new EventsController(service);
  });

  it('applique OptionalKioskTokenGuard et HttpCode 200 sur le point d’entrée ingest', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      EventsController.prototype,
      'ingest',
    );
    const value: unknown = descriptor?.value;
    if (typeof value === 'function') {
      const handler: object = value;
      expect(Reflect.getMetadata('__guards__', handler)).toEqual([
        OptionalKioskTokenGuard,
      ]);
      expect(Reflect.getMetadata('__httpCode__', handler)).toBe(HttpStatus.OK);
    } else {
      expect.fail('Méthode ingest introuvable');
    }
  });

  it('en mode kiosque avec request.kioskDevice présent, appelle ingest avec le contexte KIOSK et renvoie le résultat accepted', async () => {
    const kioskId = '01990000-0000-7000-8000-000000000101';
    const hotelId = '01990000-0000-7000-8000-000000000102';
    const request = makeRequest({ kioskId, hotelId });
    const batch: EventsBatch = {
      events: [createEvent({ channel: EVENT_CHANNELS.KIOSK })],
    };
    service.result = { accepted: 1 };

    const response = await controller.ingest(batch, request);

    expect(response).toEqual({ accepted: 1 });
    expect(service.calls).toHaveLength(1);
    const call = service.calls[0];
    expect(call).toBeDefined();
    if (call) {
      expect(call.ctx).toEqual({
        channel: EVENT_CHANNELS.KIOSK,
        kioskId,
        hotelId,
      });
      expect(call.batch).toEqual(batch);
    } else {
      expect.fail('Appel ingest attendu');
    }
  });

  it('en mode anonyme avec channel KIOSK dans le corps, appelle ingest avec le contexte WEB', async () => {
    const request = makeRequest(undefined);
    const batch: EventsBatch = {
      events: [createEvent({ channel: EVENT_CHANNELS.KIOSK })],
    };
    service.result = { accepted: 1 };

    const response = await controller.ingest(batch, request);

    expect(response).toEqual({ accepted: 1 });
    expect(service.calls).toHaveLength(1);
    const call = service.calls[0];
    expect(call).toBeDefined();
    if (call) {
      expect(call.ctx).toEqual({
        channel: EVENT_CHANNELS.WEB,
      });
      expect(call.batch).toEqual(batch);
    } else {
      expect.fail('Appel ingest attendu');
    }
  });

  it('rejette un corps invalide avec une 400 au format du dépôt et n’appelle pas ingest', async () => {
    const request = makeRequest();
    const invalidBody = { events: [] };

    let caughtError: unknown;
    try {
      await controller.ingest(invalidBody, request);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(BadRequestException);
    if (caughtError instanceof BadRequestException) {
      const response = caughtError.getResponse();
      expect(response).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: "Lot d'événements invalide",
      });
    }
    expect(service.calls).toHaveLength(0);
  });

  it('rejette un corps non-objet avec une 400 au format du dépôt et n’appelle pas ingest', async () => {
    const request = makeRequest();
    const invalidBody = 'pas-un-lot';

    let caughtError: unknown;
    try {
      await controller.ingest(invalidBody, request);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(BadRequestException);
    if (caughtError instanceof BadRequestException) {
      const response = caughtError.getResponse();
      expect(response).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: "Lot d'événements invalide",
      });
    }
    expect(service.calls).toHaveLength(0);
  });
});
