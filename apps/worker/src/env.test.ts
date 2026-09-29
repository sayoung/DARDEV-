import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('accepte REDIS_URL', () => {
    expect(loadEnv({ REDIS_URL: 'redis://localhost:6379' })).toEqual({
      REDIS_URL: 'redis://localhost:6379',
    });
  });

  it('refuse une REDIS_URL absente ou vide', () => {
    expect(() => loadEnv({})).toThrow(/REDIS_URL/);
    expect(() => loadEnv({ REDIS_URL: '' })).toThrow(/REDIS_URL/);
  });
});
