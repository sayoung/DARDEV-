import { describe, expect, it } from 'vitest';

import { InMemorySessionStore } from './in-memory-session.store.js';
import { RedisSessionStore } from './redis-session.store.js';
import {
  SESSION_IDLE_MS,
  SESSION_IDLE_SECONDS,
  sessionKey,
  type SessionRecord,
  type SessionRedis,
  userSessionsKey,
} from './session-store.js';

const record: SessionRecord = {
  userId: 'user-1',
  csrfToken: 'csrf-token-value',
  createdAt: '2026-09-29T00:00:00.000Z',
};

describe('InMemorySessionStore', () => {
  it('crée un identifiant de 32 octets et retrouve la session', async () => {
    const store = new InMemorySessionStore(() => 0);
    const id = await store.create(record);

    expect(Buffer.from(id, 'base64url')).toHaveLength(32);
    expect(id).toHaveLength(43);
    await expect(store.get(id)).resolves.toEqual(record);
  });

  it('oublie la session au bout de 8 h et touch repousse l’échéance', async () => {
    let now = 0;
    const store = new InMemorySessionStore(() => now);
    const id = await store.create(record);

    now = SESSION_IDLE_MS;
    await expect(store.get(id)).resolves.toBeNull();

    now = 0;
    const renewed = await store.create(record);
    now = SESSION_IDLE_MS - 1;
    await store.touch(renewed);
    now = SESSION_IDLE_MS - 1 + SESSION_IDLE_MS - 1;
    await expect(store.get(renewed)).resolves.toEqual(record);
  });

  it('destroy retire une session et destroyAllForUser retire celles de l’utilisateur', async () => {
    const store = new InMemorySessionStore(() => 0);
    const first = await store.create(record);
    const second = await store.create({ ...record, csrfToken: 'other-token' });
    const otherUser = await store.create({ ...record, userId: 'user-2' });

    await store.destroy(first);
    await expect(store.get(first)).resolves.toBeNull();
    await expect(store.get(second)).resolves.toEqual({ ...record, csrfToken: 'other-token' });

    await store.destroyAllForUser('user-1');
    await expect(store.get(second)).resolves.toBeNull();
    await expect(store.get(otherUser)).resolves.toEqual({ ...record, userId: 'user-2' });
  });
});

class MemoryRedis implements SessionRedis {
  readonly values = new Map<string, { value: string; expiresAt: number }>();
  readonly sets = new Map<string, Set<string>>();
  now = 0;

  get(key: string): Promise<string | null> {
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= this.now) {
      this.values.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, expiryMode: 'EX', seconds: number): Promise<unknown> {
    this.values.set(key, { value, expiresAt: this.now + seconds * 1000 });
    return Promise.resolve(expiryMode);
  }

  expire(key: string, seconds: number): Promise<number> {
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= this.now) {
      this.values.delete(key);
      return Promise.resolve(0);
    }
    entry.expiresAt = this.now + seconds * 1000;
    return Promise.resolve(1);
  }

  del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.values.delete(key)) {
        removed += 1;
      }
      if (this.sets.delete(key)) {
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  sadd(key: string, member: string): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    set.add(member);
    this.sets.set(key, set);
    return Promise.resolve(1);
  }

  srem(key: string, member: string): Promise<number> {
    const set = this.sets.get(key);
    if (set?.delete(member)) {
      if (set.size === 0) {
        this.sets.delete(key);
      }
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }

  smembers(key: string): Promise<string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }
}

describe('RedisSessionStore', () => {
  it('écrit sess:<id> avec une expiration de 8 h et indexe l’utilisateur', async () => {
    const redis = new MemoryRedis();
    const store = new RedisSessionStore(redis);
    const id = await store.create(record);

    expect(Buffer.from(id, 'base64url')).toHaveLength(32);
    const stored = redis.values.get(sessionKey(id));
    expect(stored?.expiresAt).toBe(SESSION_IDLE_SECONDS * 1000);
    expect(stored?.value).toBe(JSON.stringify(record));
    expect(redis.sets.get(userSessionsKey('user-1'))?.has(id)).toBe(true);
    await expect(store.get(id)).resolves.toEqual(record);
  });

  it('touch renouvelle l’expiration, destroy et destroyAllForUser retirent les clés', async () => {
    const redis = new MemoryRedis();
    const store = new RedisSessionStore(redis);
    const first = await store.create(record);
    const second = await store.create({ ...record, csrfToken: 'other-token' });
    const kept = await store.create({ ...record, userId: 'user-2' });

    redis.now = 5_000;
    await store.touch(first);
    expect(redis.values.get(sessionKey(first))?.expiresAt).toBe(
      5_000 + SESSION_IDLE_SECONDS * 1000,
    );

    await store.destroy(second);
    await expect(store.get(second)).resolves.toBeNull();
    expect(redis.sets.get(userSessionsKey('user-1'))?.has(second)).toBe(false);
    expect(redis.sets.get(userSessionsKey('user-1'))?.has(first)).toBe(true);

    await store.destroyAllForUser('user-1');
    await expect(store.get(first)).resolves.toBeNull();
    expect(redis.sets.has(userSessionsKey('user-1'))).toBe(false);
    await expect(store.get(kept)).resolves.toEqual({ ...record, userId: 'user-2' });
  });

  it('get retourne null si la valeur Redis n’est pas une session', async () => {
    const redis = new MemoryRedis();
    const store = new RedisSessionStore(redis);
    redis.values.set(sessionKey('not-json'), {
      value: 'pas-du-json',
      expiresAt: SESSION_IDLE_SECONDS * 1000,
    });

    await expect(store.get('not-json')).resolves.toBeNull();
  });
});
