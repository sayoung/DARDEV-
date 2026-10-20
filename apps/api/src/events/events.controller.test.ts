import 'reflect-metadata';

import { createHash } from 'node:crypto';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import {
  EVENT_CHANNELS,
  EVENT_TYPES,
  type Event,
  type EventsBatch,
} from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import {
  buildRateLimitKey,
  EVENTS_ANON_RATE_LIMIT_MAX,
  EVENTS_ANON_RATE_LIMIT_PREFIX,
  EVENTS_ANON_RATE_LIMIT_WINDOW_SECONDS,
  EventsRateLimitExceededException,
  type EventsRateLimitRedisClient,
  EventsRateLimitService,
  RATE_LIMIT_EXCEEDED,
  RATE_LIMIT_EXCEEDED_MESSAGE,
} from './events-rate-limit.js';

interface SimulatedRedisEntry {
  value: number;
  expiresInSeconds?: number;
}

class SimulatedRedis implements EventsRateLimitRedisClient {
  public data = new Map<string, SimulatedRedisEntry>();
  public expireCalls: Array<{ key: string; seconds: number }> = [];

  incr(key: string): Promise<number> {
    const current = this.data.get(key);
    const nextValue = (current?.value ?? 0) + 1;
    this.data.set(key, {
      value: nextValue,
      expiresInSeconds: current?.expiresInSeconds,
    });
    return Promise.resolve(nextValue);
  }

  expire(key: string, seconds: number): Promise<number> {
    this.expireCalls.push({ key, seconds });
    const current = this.data.get(key);
    if (current !== undefined) {
      this.data.set(key, { ...current, expiresInSeconds: seconds });
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }
}

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

function makeRequest(device?: KioskDevice, ip = '127.0.0.1'): KioskDeviceRequest {
  const requestObject = { kioskDevice: device, ip };
  if (isKioskDeviceRequest(requestObject)) {
    return requestObject;
  }
  throw new Error('Type guard KioskDeviceRequest invalide');
}

describe('EventsController', () => {
  let service: MockEventsIngestService;
  let redis: SimulatedRedis;
  let rateLimiter: EventsRateLimitService;
  let controller: EventsController;

  beforeEach(() => {
    service = new MockEventsIngestService();
    redis = new SimulatedRedis();
    rateLimiter = new EventsRateLimitService(redis);
    controller = new EventsController(service, rateLimiter);
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
    if (call !== undefined) {
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
    if (call !== undefined) {
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

  it('en mode anonyme, laisse passer 60 requêtes et renvoie 429 à la 61e', async () => {
    const clientIp = '198.51.100.1';
    const request = makeRequest(undefined, clientIp);
    const batch: EventsBatch = {
      events: [createEvent({ channel: EVENT_CHANNELS.WEB })],
    };
    service.result = { accepted: 1 };

    for (let index = 0; index < EVENTS_ANON_RATE_LIMIT_MAX; index += 1) {
      const response = await controller.ingest(batch, request);
      expect(response).toEqual({ accepted: 1 });
    }
    expect(service.calls).toHaveLength(EVENTS_ANON_RATE_LIMIT_MAX);

    let caughtError: unknown;
    try {
      await controller.ingest(batch, request);
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(EventsRateLimitExceededException);
    if (caughtError instanceof EventsRateLimitExceededException) {
      expect(caughtError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(caughtError.getResponse()).toEqual({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: {
          code: RATE_LIMIT_EXCEEDED,
          message: RATE_LIMIT_EXCEEDED_MESSAGE,
        },
        code: RATE_LIMIT_EXCEEDED,
        message: RATE_LIMIT_EXCEEDED_MESSAGE,
      });
    }
    // L'ingest n'est pas appelé pour la 61e requête
    expect(service.calls).toHaveLength(EVENTS_ANON_RATE_LIMIT_MAX);
  });

  it('en mode anonyme, expire n’est appelé qu’au premier incr et la clé ne contient pas l’IP en clair', async () => {
    const clientIp = '198.51.100.2';
    const request = makeRequest(undefined, clientIp);
    const batch: EventsBatch = {
      events: [createEvent({ channel: EVENT_CHANNELS.WEB })],
    };

    for (let index = 0; index < 5; index += 1) {
      await controller.ingest(batch, request);
    }

    expect(redis.expireCalls).toHaveLength(1);
    const call = redis.expireCalls[0];
    expect(call).toBeDefined();
    if (call !== undefined) {
      const expectedKey = buildRateLimitKey(clientIp);
      expect(call.key).toBe(expectedKey);
      expect(call.key).not.toContain(clientIp);
      expect(call.seconds).toBe(EVENTS_ANON_RATE_LIMIT_WINDOW_SECONDS);
      expect(call.key.startsWith(EVENTS_ANON_RATE_LIMIT_PREFIX)).toBe(true);
      const sha256 = createHash('sha256').update(clientIp).digest('hex');
      expect(call.key).toBe(`${EVENTS_ANON_RATE_LIMIT_PREFIX}${sha256}`);
    }
  });

  it('en mode anonyme, deux IP ont des compteurs distincts', async () => {
    const ipA = '198.51.100.10';
    const ipB = '198.51.100.20';
    const batch: EventsBatch = {
      events: [createEvent({ channel: EVENT_CHANNELS.WEB })],
    };

    for (let index = 0; index < EVENTS_ANON_RATE_LIMIT_MAX; index += 1) {
      await controller.ingest(batch, makeRequest(undefined, ipA));
    }

    // ipA a atteint la limite
    await expect(
      controller.ingest(batch, makeRequest(undefined, ipA)),
    ).rejects.toThrow(EventsRateLimitExceededException);

    // ipB peut encore poster
    const responseB = await controller.ingest(batch, makeRequest(undefined, ipB));
    expect(responseB).toEqual({ accepted: 1 });
  });

  it('le mode kiosque (Bearer valide avec kioskDevice présent) n’appelle jamais le service ni Redis', async () => {
    const kioskId = '01990000-0000-7000-8000-000000000101';
    const hotelId = '01990000-0000-7000-8000-000000000102';
    const kioskRequest = makeRequest({ kioskId, hotelId }, '198.51.100.99');
    const consumeSpy = vi.spyOn(rateLimiter, 'consume');
    const batch: EventsBatch = {
      events: [createEvent({ channel: EVENT_CHANNELS.KIOSK })],
    };

    // 70 requêtes en mode kiosque (au-delà de 60)
    for (let index = 0; index < 70; index += 1) {
      const response = await controller.ingest(batch, kioskRequest);
      expect(response).toEqual({ accepted: 1 });
    }

    expect(consumeSpy).not.toHaveBeenCalled();
    expect(redis.data.size).toBe(0);
    expect(redis.expireCalls).toHaveLength(0);
  });

  it('en mode anonyme, le service rateLimiter est appelé avec request.ip', async () => {
    const clientIp = '198.51.100.42';
    const request = makeRequest(undefined, clientIp);
    const batch: EventsBatch = {
      events: [createEvent({ channel: EVENT_CHANNELS.WEB })],
    };
    service.result = { accepted: 1 };
    const consumeSpy = vi.spyOn(rateLimiter, 'consume');

    const response = await controller.ingest(batch, request);

    expect(response).toEqual({ accepted: 1 });
    expect(consumeSpy).toHaveBeenCalledTimes(1);
    expect(consumeSpy).toHaveBeenCalledWith(clientIp);
  });

  it('en mode anonyme sans IP renseignée (chaîne vide), la requête passe et Redis n’est pas sollicité', async () => {
    const emptyIpRequest = makeRequest(undefined, '');
    const consumeSpy = vi.spyOn(rateLimiter, 'consume');
    const batch: EventsBatch = {
      events: [createEvent({ channel: EVENT_CHANNELS.WEB })],
    };

    const response = await controller.ingest(batch, emptyIpRequest);
    expect(response).toEqual({ accepted: 1 });
    expect(consumeSpy).not.toHaveBeenCalled();
    expect(redis.data.size).toBe(0);
    expect(redis.expireCalls).toHaveLength(0);
  });
});
