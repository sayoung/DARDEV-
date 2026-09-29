import { type Redis } from 'ioredis';

import {
  createSessionId,
  parseSession,
  SESSION_IDLE_SECONDS,
  sessionKey,
  type SessionRecord,
  type SessionRedis,
  type SessionStore,
  userSessionsKey,
} from './session-store.js';

/** Adapte le client ioredis au contrat étroit du store (les surcharges du client ne s'y assignent pas). */
export function asSessionRedis(redis: Redis): SessionRedis {
  return {
    get: (key) => redis.get(key),
    set: (key, value, expiryMode, seconds) => redis.set(key, value, expiryMode, seconds),
    expire: (key, seconds) => redis.expire(key, seconds),
    del: (...keys) => redis.del(...keys),
    sadd: (key, member) => redis.sadd(key, member),
    srem: (key, member) => redis.srem(key, member),
    smembers: (key) => redis.smembers(key),
  };
}

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: SessionRedis) {}

  async create(data: SessionRecord): Promise<string> {
    const id = createSessionId();
    await this.redis.set(sessionKey(id), JSON.stringify(data), 'EX', SESSION_IDLE_SECONDS);
    await this.redis.sadd(userSessionsKey(data.userId), id);
    return id;
  }

  async get(id: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(sessionKey(id));
    if (raw === null) {
      return null;
    }
    return parseSession(raw);
  }

  async touch(id: string): Promise<void> {
    await this.redis.expire(sessionKey(id), SESSION_IDLE_SECONDS);
  }

  async destroy(id: string): Promise<void> {
    const key = sessionKey(id);
    const raw = await this.redis.get(key);
    await this.redis.del(key);
    if (raw === null) {
      return;
    }
    const session = parseSession(raw);
    if (!session) {
      return;
    }
    await this.redis.srem(userSessionsKey(session.userId), id);
  }

  async destroyAllForUser(userId: string): Promise<void> {
    const indexKey = userSessionsKey(userId);
    const ids = await this.redis.smembers(indexKey);
    if (ids.length > 0) {
      await this.redis.del(...ids.map((id) => sessionKey(id)));
    }
    await this.redis.del(indexKey);
  }
}
