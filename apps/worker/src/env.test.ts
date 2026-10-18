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
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
  };

  it('accepte les variables valides', () => {
    expect(loadEnv(validEnv)).toEqual({ ...validEnv, STORAGE_PROVIDER: 's3', SMTP_PORT: 1025 });
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

    const withoutSmtpHost = { ...validEnv, SMTP_HOST: undefined };
    expect(() => loadEnv(withoutSmtpHost)).toThrow(/SMTP_HOST/);

    const emptySmtpHost = { ...validEnv, SMTP_HOST: '' };
    expect(() => loadEnv(emptySmtpHost)).toThrow(/SMTP_HOST/);

    const withoutSmtpPort = { ...validEnv, SMTP_PORT: undefined };
    expect(() => loadEnv(withoutSmtpPort)).toThrow(/SMTP_PORT/);

    const emptySmtpPort = { ...validEnv, SMTP_PORT: '' };
    expect(() => loadEnv(emptySmtpPort)).toThrow(/SMTP_PORT/);
  });
  
  it('signale plusieurs variables manquantes', () => {
    expect(() => loadEnv({})).toThrow(/REDIS_URL.*DATABASE_URL.*S3_ENDPOINT.*S3_ACCESS_KEY.*S3_SECRET_KEY.*S3_BUCKET.*SMTP_HOST.*SMTP_PORT/);
  });

  it('convertit SMTP_PORT en nombre entier', () => {
    const env = loadEnv({ ...validEnv, SMTP_PORT: '2525' });
    expect(env.SMTP_PORT).toBe(2525);
  });

  it('refuse un port SMTP invalide (non numérique, zéro, négatif, décimal ou supérieur à 65535)', () => {
    expect(() => loadEnv({ ...validEnv, SMTP_PORT: 'non-numerique' })).toThrow(/SMTP_PORT/);
    expect(() => loadEnv({ ...validEnv, SMTP_PORT: '0' })).toThrow(/SMTP_PORT/);
    expect(() => loadEnv({ ...validEnv, SMTP_PORT: '-10' })).toThrow(/SMTP_PORT/);
    expect(() => loadEnv({ ...validEnv, SMTP_PORT: '1025.5' })).toThrow(/SMTP_PORT/);
    expect(() => loadEnv({ ...validEnv, SMTP_PORT: '65536' })).toThrow(/SMTP_PORT/);
  });

  it('accepte les ports SMTP aux limites 1 et 65535', () => {
    expect(loadEnv({ ...validEnv, SMTP_PORT: '1' }).SMTP_PORT).toBe(1);
    expect(loadEnv({ ...validEnv, SMTP_PORT: '65535' }).SMTP_PORT).toBe(65_535);
  });
});
