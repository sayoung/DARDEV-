import { KioskManifestSchema, type KioskManifest } from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Storage } from './credentials.js';
import {
  clearManifest,
  KIOSK_MANIFEST_KEY,
  loadManifest,
  saveManifest,
} from './manifest-cache.js';

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    const value = this.map.get(key);
    return typeof value === 'string' ? value : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }
}

const validManifest: KioskManifest = KioskManifestSchema.parse({
  manifestVersion: '1.0.0',
  kiosk: {
    id: '01990000-0000-7000-8000-000000000001',
    label: 'Kiosk Test',
    idleTimeoutSeconds: 60,
    deviceType: 'TOUCH_SCREEN',
  },
  hotel: {
    id: '01990000-0000-7000-8000-000000000002',
    name: 'Hôtel Test',
    logoUrl: null,
    brandColor: '#6958A5',
    languages: ['fr', 'ar', 'en'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  selection: {
    featuredTourId: null,
    attractTourIds: [],
    tours: [],
  },
  categories: [],
});

describe('manifest-cache (M5 F-62)', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('sauvegarde et recharge un manifeste valide', () => {
    saveManifest(storage, validManifest);

    const serialized = storage.getItem(KIOSK_MANIFEST_KEY);
    expect(typeof serialized).toBe('string');

    const loaded = loadManifest(storage);
    expect(loaded).toEqual(validManifest);
  });

  it('renvoie null lorsque aucun manifeste n’est stocké', () => {
    expect(loadManifest(storage)).toBeNull();
  });

  it('renvoie null si le contenu stocké n’est pas du JSON valide', () => {
    storage.setItem(KIOSK_MANIFEST_KEY, '{ invalid json');
    expect(loadManifest(storage)).toBeNull();
  });

  it('renvoie null si le JSON stocké ne respecte pas KioskManifestSchema', () => {
    storage.setItem(
      KIOSK_MANIFEST_KEY,
      JSON.stringify({ manifestVersion: 'invalid', kiosk: {} }),
    );
    expect(loadManifest(storage)).toBeNull();
  });

  it('efface le manifeste stocké avec clearManifest', () => {
    saveManifest(storage, validManifest);
    expect(loadManifest(storage)).not.toBeNull();

    clearManifest(storage);
    expect(loadManifest(storage)).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('refuse de sauvegarder un manifeste invalide', () => {
    const invalidCandidate: KioskManifest = {
      ...validManifest,
      kiosk: {
        ...validManifest.kiosk,
        id: 'not-a-valid-uuid',
      },
    };
    expect(() => {
      saveManifest(storage, invalidCandidate);
    }).toThrow();
  });
});
