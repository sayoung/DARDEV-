import { describe, expect, it } from 'vitest';

import { createSessionManager } from './session.js';

describe('createSessionManager', () => {
  it('crée une session avec un nouvel identifiant à chaque démarrage', () => {
    let nextId = 0;
    const manager = createSessionManager(() => `session-${String(++nextId)}`);

    const firstId = manager.start();
    expect(manager.current()).toBe(firstId);

    const secondId = manager.start();
    expect(secondId).not.toBe(firstId);
    expect(manager.current()).toBe(secondId);
  });

  it('renvoie puis clôture la session courante', () => {
    const manager = createSessionManager(() => 'session-1');
    const sessionId = manager.start();

    expect(manager.end()).toBe(sessionId);
    expect(manager.current()).toBeNull();
  });

  it('renvoie null quand aucune session n’est en cours', () => {
    const manager = createSessionManager(() => 'session-1');

    expect(manager.current()).toBeNull();
    expect(manager.end()).toBeNull();
    expect(manager.current()).toBeNull();
  });
});
