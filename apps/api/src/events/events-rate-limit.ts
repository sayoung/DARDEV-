import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import { REDIS } from '../redis/redis.module.js';

export const EVENTS_ANON_RATE_LIMIT_MAX = 60;
export const EVENTS_ANON_RATE_LIMIT_WINDOW_SECONDS = 60;
export const EVENTS_ANON_RATE_LIMIT_PREFIX = 'rl:events:anon:';
export const RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED';
export const RATE_LIMIT_EXCEEDED_MESSAGE = 'Trop de requêtes. Veuillez réessayer plus tard.';

export interface EventsRateLimitRedisClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

export class EventsRateLimitExceededException extends HttpException {
  constructor(message: string = RATE_LIMIT_EXCEEDED_MESSAGE) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: {
          code: RATE_LIMIT_EXCEEDED,
          message,
        },
        code: RATE_LIMIT_EXCEEDED,
        message,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

export function buildRateLimitKey(ip: string): string {
  return `${EVENTS_ANON_RATE_LIMIT_PREFIX}${hashIp(ip)}`;
}

export async function checkAnonymousEventsRateLimit(
  redis: EventsRateLimitRedisClient,
  ip: string,
  maxRequests: number = EVENTS_ANON_RATE_LIMIT_MAX,
  windowSeconds: number = EVENTS_ANON_RATE_LIMIT_WINDOW_SECONDS,
): Promise<number> {
  const normalizedIp = ip.trim();
  if (normalizedIp.length === 0) {
    return 0;
  }
  const key = buildRateLimitKey(normalizedIp);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  if (count > maxRequests) {
    throw new EventsRateLimitExceededException();
  }
  return count;
}

@Injectable()
export class EventsRateLimitService {
  constructor(
    @Inject(REDIS)
    private readonly redis: EventsRateLimitRedisClient,
  ) {}

  async consume(ip?: string): Promise<number> {
    if (typeof ip !== 'string' || ip.trim().length === 0) {
      return 0;
    }
    return checkAnonymousEventsRateLimit(this.redis, ip);
  }
}
