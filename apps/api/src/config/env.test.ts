import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

function exampleEnv(): Record<string, string | undefined> {
  return {
    PORT: '3000',
    DATABASE_URL: 'postgresql://xplor:xplor@localhost:5432/xplor',
    REDIS_URL: 'redis://localhost:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'xplor',
    S3_SECRET_KEY: 'xplor-dev-secret',
    S3_BUCKET: 'xplor',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SESSION_SECRET: 'dev-only-session-secret-not-for-production',
  };
}

describe('loadEnv', () => {
  it('accepts a valid environment', () => {
    const env = loadEnv(exampleEnv());
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_URL).toBe('postgresql://xplor:xplor@localhost:5432/xplor');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.S3_ENDPOINT).toBe('http://localhost:9000');
    expect(env.S3_ACCESS_KEY).toBe('xplor');
    expect(env.S3_SECRET_KEY).toBe('xplor-dev-secret');
    expect(env.S3_BUCKET).toBe('xplor');
    expect(env.SMTP_HOST).toBe('localhost');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SESSION_SECRET).toBe('dev-only-session-secret-not-for-production');

    const withoutPort = exampleEnv();
    delete withoutPort.PORT;
    expect(loadEnv(withoutPort).PORT).toBe(3000);
  });

  it('rejects a SESSION_SECRET that is too short', () => {
    expect(() => loadEnv({ ...exampleEnv(), SESSION_SECRET: 'a'.repeat(31) })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('names a missing variable in the error', () => {
    const source = exampleEnv();
    delete source.DATABASE_URL;
    expect(() => loadEnv(source)).toThrow(/DATABASE_URL/);
  });
});
