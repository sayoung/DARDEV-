import { describe, expect, it } from 'vitest';

import {
  clearCredentials,
  KIOSK_CREDENTIALS_KEY,
  loadCredentials,
  saveCredentials,
  type Storage,
} from './credentials.js';

const credentials = {
  kioskId: '550e8400-e29b-41d4-a716-446655440000',
  token: 'device-token',
};

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('identifiants du kiosque', () => {
  it('sauvegarde et recharge les identifiants validés sous la clé unique', () => {
    const storage = new MemoryStorage();

    saveCredentials(storage, credentials);

    expect([...storage.values.keys()]).toEqual([KIOSK_CREDENTIALS_KEY]);
    expect(storage.getItem(KIOSK_CREDENTIALS_KEY)).toBe(JSON.stringify(credentials));
    expect(loadCredentials(storage)).toEqual(credentials);
  });

  it('retourne null quand aucun identifiant n’est enregistré', () => {
    expect(loadCredentials(new MemoryStorage())).toBeNull();
  });

  it.each(['{', JSON.stringify({ kioskId: 'invalid', token: 'device-token' }), JSON.stringify({
    kioskId: credentials.kioskId,
    token: '',
  })])('retourne null pour une valeur corrompue ou invalide', (value) => {
    const storage = new MemoryStorage();
    storage.setItem(KIOSK_CREDENTIALS_KEY, value);

    expect(loadCredentials(storage)).toBeNull();
  });

  it('efface les identifiants enregistrés', () => {
    const storage = new MemoryStorage();
    saveCredentials(storage, credentials);

    clearCredentials(storage);

    expect(storage.values.size).toBe(0);
    expect(loadCredentials(storage)).toBeNull();
  });

  it('refuse de sauvegarder des identifiants invalides', () => {
    const storage = new MemoryStorage();

    expect(() => {
      saveCredentials(storage, { ...credentials, kioskId: 'invalid' });
    }).toThrow();
    expect(storage.values.size).toBe(0);
  });
});
