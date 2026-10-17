import { describe, expect, it } from 'vitest';

import { KioskHeartbeatRequestSchema } from '@xplor/shared';

import {
  buildHeartbeat,
  type StorageEstimateProvider,
} from './heartbeat.js';

describe('buildHeartbeat', () => {
  describe('calcul du stockage libre (storageFreeMb)', () => {
    it('calcule storageFreeMb en arrondissant à l’entier inférieur (floor)', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => Promise.resolve({
          quota: 10 * 1_048_576 + 500_000,
          usage: 2 * 1_048_576,
        }),
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: 'manifest-v1',
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBe(8);
      expect(KioskHeartbeatRequestSchema.safeParse(heartbeat).success).toBe(true);
    });

    it('calcule storageFreeMb à 0 quand l’espace libre est inférieur à 1 Mo', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => Promise.resolve({
          quota: 2_000_000,
          usage: 1_500_000,
        }),
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: 'manifest-v1',
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBe(0);
      expect(KioskHeartbeatRequestSchema.safeParse(heartbeat).success).toBe(true);
    });

    it('calcule storageFreeMb à 0 quand le quota et l’usage sont égaux', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => Promise.resolve({
          quota: 10_000_000,
          usage: 10_000_000,
        }),
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: 'manifest-v1',
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBe(0);
    });

    it('calcule storageFreeMb à 0 quand l’usage dépasse le quota', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => Promise.resolve({
          quota: 5_000_000,
          usage: 6_000_000,
        }),
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: null,
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBe(0);
    });
  });

  describe('stockage absent ou incomplet', () => {
    it('renvoie storageFreeMb à null quand storage est undefined', async () => {
      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: null,
        storage: undefined,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBeNull();
      expect(KioskHeartbeatRequestSchema.safeParse(heartbeat).success).toBe(true);
    });

    it('renvoie storageFreeMb à null quand storage est omis', async () => {
      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: 'v2',
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBeNull();
    });

    it('renvoie storageFreeMb à null quand quota est indéfini', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => Promise.resolve({
          usage: 1_000_000,
        }),
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: null,
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBeNull();
    });

    it('renvoie storageFreeMb à null quand usage est indéfini', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => Promise.resolve({
          quota: 10_000_000,
        }),
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: null,
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBeNull();
    });

    it('renvoie storageFreeMb à null quand quota ou usage n’est pas fini', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => Promise.resolve({
          quota: Number.NaN,
          usage: 100,
        }),
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: null,
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBeNull();
    });
  });

  describe('estimate qui rejette', () => {
    it('renvoie storageFreeMb à null quand estimate rejette une promesse', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => Promise.reject(new Error('Storage estimate failed')),
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: 'v3',
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBeNull();
      expect(KioskHeartbeatRequestSchema.safeParse(heartbeat).success).toBe(true);
    });

    it('renvoie storageFreeMb à null quand estimate lève une exception synchrone', async () => {
      const storage: StorageEstimateProvider = {
        estimate: () => {
          throw new Error('Sync storage failure');
        },
      };

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: 'v3',
        storage,
        recentErrors: [],
      });

      expect(heartbeat.storageFreeMb).toBeNull();
    });
  });

  describe('troncature des erreurs récentes', () => {
    it('tronque recentErrors à 10 entrées quand la liste en contient plus', async () => {
      const errors = Array.from({ length: 15 }, (_, index) => `error-${String(index + 1)}`);

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: null,
        storage: undefined,
        recentErrors: errors,
      });

      expect(heartbeat.recentErrors).toHaveLength(10);
      expect(heartbeat.recentErrors).toEqual([
        'error-1',
        'error-2',
        'error-3',
        'error-4',
        'error-5',
        'error-6',
        'error-7',
        'error-8',
        'error-9',
        'error-10',
      ]);
      expect(KioskHeartbeatRequestSchema.safeParse(heartbeat).success).toBe(true);
    });

    it('tronque chaque erreur à 300 caractères au maximum', async () => {
      const longError = 'x'.repeat(350);

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: null,
        storage: undefined,
        recentErrors: [longError, 'short-error'],
      });

      expect(heartbeat.recentErrors).toHaveLength(2);
      expect(heartbeat.recentErrors[0]).toHaveLength(300);
      expect(heartbeat.recentErrors[0]).toBe('x'.repeat(300));
      expect(heartbeat.recentErrors[1]).toBe('short-error');
      expect(KioskHeartbeatRequestSchema.safeParse(heartbeat).success).toBe(true);
    });

    it('combine la troncature du nombre d’entrées et de la longueur des messages', async () => {
      const errors = Array.from(
        { length: 12 },
        (_, index) => `error-${String(index + 1)}-${'z'.repeat(320)}`,
      );

      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: 'v1',
        storage: undefined,
        recentErrors: errors,
      });

      expect(heartbeat.recentErrors).toHaveLength(10);
      for (const err of heartbeat.recentErrors) {
        expect(err.length).toBeLessThanOrEqual(300);
      }
      expect(KioskHeartbeatRequestSchema.safeParse(heartbeat).success).toBe(true);
    });

    it('utilise un tableau vide par défaut quand recentErrors est omis', async () => {
      const heartbeat = await buildHeartbeat({
        appVersion: '1.0.0',
        syncedManifestVersion: null,
      });

      expect(heartbeat.recentErrors).toEqual([]);
      expect(KioskHeartbeatRequestSchema.safeParse(heartbeat).success).toBe(true);
    });
  });

  describe('validation du schéma', () => {
    it('échoue à la validation si appVersion dépasse 50 caractères', async () => {
      await expect(
        buildHeartbeat({
          appVersion: 'v'.repeat(51),
          syncedManifestVersion: null,
          storage: undefined,
          recentErrors: [],
        }),
      ).rejects.toThrow();
    });

    it('accepte une version de manifeste synchronisée renseignée ou nulle', async () => {
      const withVersion = await buildHeartbeat({
        appVersion: '1.2.3',
        syncedManifestVersion: 'sync-hash-123',
        storage: undefined,
        recentErrors: [],
      });
      expect(withVersion.syncedManifestVersion).toBe('sync-hash-123');

      const withNull = await buildHeartbeat({
        appVersion: '1.2.3',
        syncedManifestVersion: null,
        storage: undefined,
        recentErrors: [],
      });
      expect(withNull.syncedManifestVersion).toBeNull();
    });
  });
});
