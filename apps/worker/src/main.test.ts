import { describe, expect, it } from 'vitest';

import { boot } from './main.js';

describe('boot', () => {
  const validEnv = {
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://xplor:xplor@localhost:5432/xplor',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'xplor',
    S3_SECRET_KEY: 'xplor-dev-secret',
    S3_BUCKET: 'xplor',
  };

  it('valide l\'environnement puis journalise worker prêt', () => {
    const messages: string[] = [];
    boot(validEnv, (message) => {
      messages.push(message);
    });
    expect(messages).toEqual(['worker prêt']);
  });

  it('ne journalise pas si l\'environnement est invalide', () => {
    const messages: string[] = [];
    expect(() => {
      boot({}, (message) => {
        messages.push(message);
      });
    }).toThrow(/REDIS_URL/);
    expect(messages).toEqual([]);
  });
});
