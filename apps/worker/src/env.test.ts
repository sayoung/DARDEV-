import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  const validEnv = {
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://xplor:xplor@localhost:5432/xplor',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'xplor',
    S3_SECRET_KEY: 'xplor-dev-secret',
    S3_BUCKET: 'xplor',
  };

  it('accepte les variables valides', () => {
    expect(loadEnv(validEnv)).toEqual({ ...validEnv, STORAGE_PROVIDER: 's3' });
  });

  it('refuse STORAGE_PROVIDER=local avec un message clair', () => {
    const withLocal = { ...validEnv, STORAGE_PROVIDER: 'local' };
    expect(() => loadEnv(withLocal)).toThrow(/Le worker ne supporte pas STORAGE_PROVIDER=local/);
  });

  it('refuse une variable absente ou vide et la nomme', () => {
    const withoutRedis = { ...validEnv, REDIS_URL: undefined };
    expect(() => loadEnv(withoutRedis)).toThrow(/REDIS_URL/);
    
    const emptyS3 = { ...validEnv, S3_BUCKET: '' };
    expect(() => loadEnv(emptyS3)).toThrow(/S3_BUCKET/);
  });
  
  it('signale plusieurs variables manquantes', () => {
    expect(() => loadEnv({})).toThrow(/REDIS_URL.*DATABASE_URL.*S3_ENDPOINT.*S3_ACCESS_KEY.*S3_SECRET_KEY.*S3_BUCKET/);
  });
});
