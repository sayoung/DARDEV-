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
    ADMIN_BASE_URL: 'http://localhost:5173',
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
    expect(env.ADMIN_BASE_URL).toBe('http://localhost:5173');

    const withoutPort = exampleEnv();
    delete withoutPort.PORT;
    expect(loadEnv(withoutPort).PORT).toBe(3000);
  });

  it('rejects a SESSION_SECRET that is too short', () => {
    expect(() => loadEnv({ ...exampleEnv(), SESSION_SECRET: 'a'.repeat(31) })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('defaults ADMIN_BASE_URL to the back-office and rejects a non-URL', () => {
    const source = exampleEnv();
    delete source.ADMIN_BASE_URL;
    expect(loadEnv(source).ADMIN_BASE_URL).toBe('http://localhost:5173');
    expect(
      loadEnv({ ...exampleEnv(), ADMIN_BASE_URL: 'https://admin.xplor.local' }).ADMIN_BASE_URL,
    ).toBe('https://admin.xplor.local');
    expect(() => loadEnv({ ...exampleEnv(), ADMIN_BASE_URL: 'not-a-url' })).toThrow(
      /ADMIN_BASE_URL/,
    );
  });

  it('names a missing variable in the error', () => {
    const source = exampleEnv();
    delete source.DATABASE_URL;
    expect(() => loadEnv(source)).toThrow(/DATABASE_URL/);
  });

  it('defaults MEDIA_PUBLIC_URL and validates its format', () => {
    // Default
    expect(loadEnv(exampleEnv()).MEDIA_PUBLIC_URL).toBe('http://localhost:9000/xplor');
    // Valid value
    expect(
      loadEnv({ ...exampleEnv(), MEDIA_PUBLIC_URL: 'https://media.xplor.local' }).MEDIA_PUBLIC_URL,
    ).toBe('https://media.xplor.local');
    // Reject trailing slash
    expect(() =>
      loadEnv({ ...exampleEnv(), MEDIA_PUBLIC_URL: 'https://media.xplor.local/' }),
    ).toThrow(/MEDIA_PUBLIC_URL/);
    // Reject invalid URL
    expect(() => loadEnv({ ...exampleEnv(), MEDIA_PUBLIC_URL: 'not-a-url' })).toThrow(
      /MEDIA_PUBLIC_URL/,
    );
  });
});
