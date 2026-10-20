import { createHash } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildRateLimitKey,
  checkAnonymousEventsRateLimit,
  EVENTS_ANON_RATE_LIMIT_MAX,
  EVENTS_ANON_RATE_LIMIT_PREFIX,
  EVENTS_ANON_RATE_LIMIT_WINDOW_SECONDS,
  EventsRateLimitExceededException,
  type EventsRateLimitRedisClient,
  EventsRateLimitService,
  hashIp,
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

describe('EventsRateLimitService & checkAnonymousEventsRateLimit', () => {
  let redis: SimulatedRedis;
  let service: EventsRateLimitService;

  beforeEach(() => {
    redis = new SimulatedRedis();
    service = new EventsRateLimitService(redis);
  });

  it('génère une clé préfixée contenant le sha256 de l’adresse IP sans jamais inclure l’IP en clair', () => {
    const ip = '192.0.2.42';
    const key = buildRateLimitKey(ip);
    const expectedHash = createHash('sha256').update(ip).digest('hex');

    expect(key).toBe(`${EVENTS_ANON_RATE_LIMIT_PREFIX}${expectedHash}`);
    expect(key).not.toContain(ip);
    expect(hashIp(ip)).toBe(expectedHash);
  });

  it('appelle expire uniquement au premier incr avec la durée de 60 secondes', async () => {
    const ip = '192.0.2.1';

    for (let index = 0; index < 5; index += 1) {
      await service.consume(ip);
    }

    expect(redis.expireCalls).toHaveLength(1);
    const firstCall = redis.expireCalls[0];
    expect(firstCall).toBeDefined();
    if (firstCall !== undefined) {
      expect(firstCall.key).toBe(buildRateLimitKey(ip));
      expect(firstCall.seconds).toBe(EVENTS_ANON_RATE_LIMIT_WINDOW_SECONDS);
      expect(firstCall.key).not.toContain(ip);
    }
  });

  it('laisse passer 60 requêtes et rejette la 61e avec une exception HTTP 429 au format du dépôt', async () => {
    const ip = '192.0.2.2';

    for (let count = 1; count <= EVENTS_ANON_RATE_LIMIT_MAX; count += 1) {
      const result = await service.consume(ip);
      expect(result).toBe(count);
    }

    let caughtError: unknown;
    try {
      await service.consume(ip);
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(EventsRateLimitExceededException);
    if (caughtError instanceof EventsRateLimitExceededException) {
      expect(caughtError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const response = caughtError.getResponse();
      expect(response).toEqual({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: {
          code: RATE_LIMIT_EXCEEDED,
          message: RATE_LIMIT_EXCEEDED_MESSAGE,
        },
        code: RATE_LIMIT_EXCEEDED,
        message: RATE_LIMIT_EXCEEDED_MESSAGE,
      });
    }
  });

  it('maintient des compteurs distincts pour deux adresses IP différentes', async () => {
    const ipA = '192.0.2.10';
    const ipB = '192.0.2.20';

    for (let index = 0; index < EVENTS_ANON_RATE_LIMIT_MAX; index += 1) {
      await service.consume(ipA);
    }

    // ipA est à la limite : la 61e échoue
    await expect(service.consume(ipA)).rejects.toThrow(
      EventsRateLimitExceededException,
    );

    // ipB n'a pas encore consommé : la 1ère passe avec succès
    const resultB = await service.consume(ipB);
    expect(resultB).toBe(1);

    // ipB peut monter jusqu'à 60
    for (let index = 2; index <= EVENTS_ANON_RATE_LIMIT_MAX; index += 1) {
      const intermediate = await service.consume(ipB);
      expect(intermediate).toBe(index);
    }

    // la 61e pour ipB échoue à son tour
    await expect(service.consume(ipB)).rejects.toThrow(
      EventsRateLimitExceededException,
    );
  });

  it('fonctionne également via la fonction pure checkAnonymousEventsRateLimit', async () => {
    const ip = '192.0.2.99';
    const count = await checkAnonymousEventsRateLimit(redis, ip, 2, 30);
    expect(count).toBe(1);
    expect(redis.expireCalls).toHaveLength(1);
    const call = redis.expireCalls[0];
    if (call !== undefined) {
      expect(call.seconds).toBe(30);
    }
  });

  it('ne sollicite pas Redis si l’adresse IP est vide ou composée d’espaces', async () => {
    const result = await service.consume('   ');
    expect(result).toBe(0);
    expect(redis.data.size).toBe(0);
    expect(redis.expireCalls).toHaveLength(0);

    const pureResult = await checkAnonymousEventsRateLimit(redis, '');
    expect(pureResult).toBe(0);
    expect(redis.data.size).toBe(0);
    expect(redis.expireCalls).toHaveLength(0);
  });
});
