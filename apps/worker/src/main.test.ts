import { describe, expect, it } from 'vitest';

import { boot } from './main.js';

describe('boot', () => {
  it('valide REDIS_URL puis journalise worker prêt', () => {
    const messages: string[] = [];
    boot({ REDIS_URL: 'redis://localhost:6379' }, (message) => {
      messages.push(message);
    });
    expect(messages).toEqual(['worker prêt']);
  });

  it('ne journalise pas si REDIS_URL est absente', () => {
    const messages: string[] = [];
    expect(() => {
      boot({}, (message) => {
        messages.push(message);
      });
    }).toThrow(/REDIS_URL/);
    expect(messages).toEqual([]);
  });
});
