import { describe, expect, it } from 'vitest';

import {
  createPinCache,
  KIOSK_PIN_CACHE_KEY,
  PinCacheRecordSchema,
  type Storage,
} from './pin-cache.js';

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

describe('PIN cache hors-ligne (F-67)', () => {
  const subtle = globalThis.crypto.subtle;
  const randomBytes = (n: number): Uint8Array =>
    globalThis.crypto.getRandomValues(new Uint8Array(n));

  it('mémorise un code PIN et vérifie avec succès le bon code', async () => {
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes);

    await cache.remember('1234');

    const verified = await cache.verify('1234');
    expect(verified).toBe(true);
  });

  it('rejette la vérification si le code PIN est incorrect', async () => {
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes);

    await cache.remember('1234');

    const verifiedWrong = await cache.verify('9999');
    expect(verifiedWrong).toBe(false);

    const verifiedAnother = await cache.verify('0000');
    expect(verifiedAnother).toBe(false);
  });

  it('retourne false lorsque le cache est vide', async () => {
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes);

    const verified = await cache.verify('1234');
    expect(verified).toBe(false);
  });

  it('efface le cache avec clear et empêche les vérifications ultérieures', async () => {
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes);

    await cache.remember('1234');
    expect(await cache.verify('1234')).toBe(true);
    expect(storage.getItem(KIOSK_PIN_CACHE_KEY)).not.toBeNull();

    cache.clear();

    expect(storage.getItem(KIOSK_PIN_CACHE_KEY)).toBeNull();
    expect(await cache.verify('1234')).toBe(false);
  });

  it('ne stocke jamais le code PIN en clair dans le storage', async () => {
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes);
    const secretPin = 'super-secret-pin-7391';

    await cache.remember(secretPin);

    const rawStored = storage.getItem(KIOSK_PIN_CACHE_KEY);
    expect(rawStored).not.toBeNull();
    if (rawStored !== null) {
      expect(rawStored.includes(secretPin)).toBe(false);

      const parsed: unknown = JSON.parse(rawStored);
      const parseResult = PinCacheRecordSchema.safeParse(parsed);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.salt).toMatch(/^[0-9a-f]+$/i);
        expect(parseResult.data.hash).toMatch(/^[0-9a-f]{64}$/i);
        expect(parseResult.data.salt.includes(secretPin)).toBe(false);
        expect(parseResult.data.hash.includes(secretPin)).toBe(false);
      }
    }

    for (const [key, value] of storage.values.entries()) {
      expect(key.includes(secretPin)).toBe(false);
      expect(value.includes(secretPin)).toBe(false);
    }
  });

  it('génère un sel aléatoire distinct à chaque mémorisation', async () => {
    const storage1 = new MemoryStorage();
    const cache1 = createPinCache(storage1, subtle, randomBytes);

    const storage2 = new MemoryStorage();
    const cache2 = createPinCache(storage2, subtle, randomBytes);

    await cache1.remember('1234');
    await cache2.remember('1234');

    const raw1 = storage1.getItem(KIOSK_PIN_CACHE_KEY);
    const raw2 = storage2.getItem(KIOSK_PIN_CACHE_KEY);
    expect(raw1).not.toBeNull();
    expect(raw2).not.toBeNull();
    if (raw1 !== null && raw2 !== null) {
      expect(raw1).not.toBe(raw2);

      const parsed1: unknown = JSON.parse(raw1);
      const parsed2: unknown = JSON.parse(raw2);
      const record1 = PinCacheRecordSchema.parse(parsed1);
      const record2 = PinCacheRecordSchema.parse(parsed2);

      expect(record1.salt).not.toBe(record2.salt);
      expect(record1.hash).not.toBe(record2.hash);
    }
  });

  it('retourne false sans lever d’erreur si les données en cache sont corrompues', async () => {
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes);

    storage.setItem(KIOSK_PIN_CACHE_KEY, 'not-valid-json');
    expect(await cache.verify('1234')).toBe(false);

    storage.setItem(KIOSK_PIN_CACHE_KEY, JSON.stringify({ salt: 'only-salt' }));
    expect(await cache.verify('1234')).toBe(false);

    storage.setItem(KIOSK_PIN_CACHE_KEY, JSON.stringify({ hash: 'only-hash' }));
    expect(await cache.verify('1234')).toBe(false);

    storage.setItem(
      KIOSK_PIN_CACHE_KEY,
      JSON.stringify({ salt: '', hash: 'abc' }),
    );
    expect(await cache.verify('1234')).toBe(false);
  });

  it('retourne false si le PIN soumis à verify est vide ou ne contient que des espaces', async () => {
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes);

    await cache.remember('1234');

    expect(await cache.verify('')).toBe(false);
    expect(await cache.verify('   ')).toBe(false);
  });

  it('rejette la mémorisation si le code PIN est vide ou ne contient que des espaces', async () => {
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes);

    await expect(cache.remember('')).rejects.toThrow();
    await expect(cache.remember('   ')).rejects.toThrow();
    expect(storage.getItem(KIOSK_PIN_CACHE_KEY)).toBeNull();
  });

  it('permet de surcharger la clé de stockage utilisée', async () => {
    const customKey = 'xplor.custom.pin';
    const storage = new MemoryStorage();
    const cache = createPinCache(storage, subtle, randomBytes, customKey);

    await cache.remember('5678');
    expect(storage.getItem(customKey)).not.toBeNull();
    expect(storage.getItem(KIOSK_PIN_CACHE_KEY)).toBeNull();
    expect(await cache.verify('5678')).toBe(true);

    cache.clear();
    expect(storage.getItem(customKey)).toBeNull();
    expect(await cache.verify('5678')).toBe(false);
  });
});
