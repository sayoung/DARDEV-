import { describe, expect, it } from 'vitest';

import type { KioskManifest } from '@xplor/shared';

import { runSync } from './sync-runner.js';
import {
  type CacheEntryLike,
  type CacheStorageLike,
  createTourCache,
  getStagingCacheName,
  getTourCacheName,
} from './tour-cache.js';
import type { TourCacheIndex } from './tour-cache-index.js';

class FakeCacheEntry implements CacheEntryLike {
  public entries = new Map<string, unknown>();
  public deletedKeys: string[] = [];
  public putCalls: Array<{ url: string; response: unknown }> = [];
  public shouldFailPut = false;

  put(url: string, response: unknown): Promise<void> {
    if (this.shouldFailPut) {
      return Promise.reject(new Error(`Erreur d'écriture pour ${url}`));
    }
    this.putCalls.push({ url, response });
    this.entries.set(url, response);
    return Promise.resolve();
  }

  delete(url: string): Promise<boolean> {
    this.deletedKeys.push(url);
    return Promise.resolve(this.entries.delete(url));
  }

  keys(): Promise<string[]> {
    return Promise.resolve(Array.from(this.entries.keys()));
  }

  match(url: string): Promise<unknown> {
    return Promise.resolve(this.entries.get(url));
  }
}

class FakeCacheStorage implements CacheStorageLike {
  public caches = new Map<string, FakeCacheEntry>();
  public deletedCaches: string[] = [];

  open(name: string): Promise<FakeCacheEntry> {
    let cache = this.caches.get(name);
    if (cache === undefined) {
      cache = new FakeCacheEntry();
      this.caches.set(name, cache);
    }
    return Promise.resolve(cache);
  }

  delete(name: string): Promise<boolean> {
    this.deletedCaches.push(name);
    return Promise.resolve(this.caches.delete(name));
  }
}

class FakeTourCacheIndex implements TourCacheIndex {
  public versionsMap = new Map<string, number>();
  public setCalls: Array<{ tourId: string; contentVersion: number }> = [];
  public removeCalls: string[] = [];

  constructor(initial: Record<string, number> = {}) {
    for (const [id, ver] of Object.entries(initial)) {
      this.versionsMap.set(id, ver);
    }
  }

  versions(): Promise<Record<string, number>> {
    const res: Record<string, number> = {};
    for (const [id, ver] of this.versionsMap.entries()) {
      res[id] = ver;
    }
    return Promise.resolve(res);
  }

  set(tourId: string, contentVersion: number): Promise<void> {
    this.setCalls.push({ tourId, contentVersion });
    this.versionsMap.set(tourId, contentVersion);
    return Promise.resolve();
  }

  remove(tourId: string): Promise<void> {
    this.removeCalls.push(tourId);
    this.versionsMap.delete(tourId);
    return Promise.resolve();
  }
}

const baseManifest: KioskManifest = {
  manifestVersion: 'v1',
  kiosk: {
    id: '00000000-0000-4000-8000-000000000001',
    label: 'Hall',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_SCREEN',
  },
  hotel: {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Hôtel Exemple',
    logoUrl: null,
    brandColor: '#6958A5',
    languages: ['fr'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  selection: {
    featuredTourId: null,
    attractTourIds: [],
    tours: [],
  },
  categories: [],
};

describe('tour-cache', () => {
  it('télécharge dans tour-<id>-staging puis committe vers tour-<id> avec mise à jour de l’index (succès)', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex();
    const fetchedUrls: string[] = [];

    const fetchFn = (url: string): Promise<unknown> => {
      fetchedUrls.push(url);
      return Promise.resolve({ data: `contenu-${url}` });
    };

    const urlsMap: Record<string, string[]> = {
      'tour-1': ['/tours/tour-1/meta.json', '/tours/tour-1/scene1.jpg'],
    };

    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn,
      urlsForTour: (id) => urlsMap[id] ?? [],
    });

    // 1. Avant downloadTour : aucun cache ni version
    expect(await cache.versions()).toEqual({});

    // 2. downloadTour télécharge dans le cache staging
    await cache.downloadTour('tour-1');

    expect(fetchedUrls).toEqual([
      '/tours/tour-1/meta.json',
      '/tours/tour-1/scene1.jpg',
    ]);

    const stagingCache = storage.caches.get(getStagingCacheName('tour-1'));
    expect(stagingCache).toBeDefined();
    if (stagingCache !== undefined) {
      expect(await stagingCache.keys()).toEqual([
        '/tours/tour-1/meta.json',
        '/tours/tour-1/scene1.jpg',
      ]);
    }

    // Le cache définitif n'est pas encore créé
    expect(storage.caches.has(getTourCacheName('tour-1'))).toBe(false);
    expect(await cache.versions()).toEqual({});

    // 3. commitTour bascule vers tour-<id> et enregistre l'index
    await cache.commitTour('tour-1', 1);

    const prodCache = storage.caches.get(getTourCacheName('tour-1'));
    expect(prodCache).toBeDefined();
    if (prodCache !== undefined) {
      expect(await prodCache.keys()).toEqual([
        '/tours/tour-1/meta.json',
        '/tours/tour-1/scene1.jpg',
      ]);
      expect(await prodCache.match('/tours/tour-1/meta.json')).toEqual({
        data: 'contenu-/tours/tour-1/meta.json',
      });
    }

    // Staging supprimé
    expect(storage.caches.has(getStagingCacheName('tour-1'))).toBe(false);
    expect(storage.deletedCaches).toContain(getStagingCacheName('tour-1'));

    // Index mis à jour
    expect(await cache.versions()).toEqual({ 'tour-1': 1 });
    expect(index.setCalls).toEqual([{ tourId: 'tour-1', contentVersion: 1 }]);
  });

  it('remplace l’ancienne version lors du commitTour (remplace l’ancien)', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex({ 'tour-1': 1 });

    // Pré-remplir le cache cible en version 1 avec 2 fichiers
    const oldProdCache = await storage.open(getTourCacheName('tour-1'));
    await oldProdCache.put('/tours/tour-1/v1-old.json', { v: 1 });
    await oldProdCache.put('/tours/tour-1/shared.jpg', { v: 1 });

    const fetchFn = (url: string): Promise<unknown> => {
      return Promise.resolve({ v: 2, url });
    };

    // La version 2 contient shared.jpg et un nouveau fichier v2-new.json, mais plus v1-old.json
    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn,
      urlsForTour: () => ['/tours/tour-1/shared.jpg', '/tours/tour-1/v2-new.json'],
    });

    await cache.downloadTour('tour-1');
    await cache.commitTour('tour-1', 2);

    const prodCache = storage.caches.get(getTourCacheName('tour-1'));
    expect(prodCache).toBeDefined();
    if (prodCache !== undefined) {
      const keys = await prodCache.keys();
      // L'ancien fichier v1-old.json doit avoir disparu
      expect(keys).toEqual([
        '/tours/tour-1/shared.jpg',
        '/tours/tour-1/v2-new.json',
      ]);
      expect(keys).not.toContain('/tours/tour-1/v1-old.json');
    }

    expect(await cache.versions()).toEqual({ 'tour-1': 2 });
  });

  it('supprime le staging et conserve l’ancienne version en cache lors d’un échec réseau', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex({ 'tour-failing': 1 });

    // Version 1 existante et intacte
    const initialProdCache = await storage.open(
      getTourCacheName('tour-failing'),
    );
    await initialProdCache.put('/tours/tour-failing/v1.json', { status: 'v1' });

    let callCount = 0;
    const fetchFn = (url: string): Promise<unknown> => {
      callCount += 1;
      if (url.includes('error')) {
        return Promise.reject(new Error('Network disconnected'));
      }
      return Promise.resolve({ data: url });
    };

    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn,
      urlsForTour: () => [
        '/tours/tour-failing/file1.jpg',
        '/tours/tour-failing/error.jpg',
      ],
    });

    // downloadTour doit échouer
    await expect(cache.downloadTour('tour-failing')).rejects.toThrow(
      'Network disconnected',
    );
    expect(callCount).toBe(2);

    // Staging supprimé (pas de résidu incomplet)
    expect(storage.caches.has(getStagingCacheName('tour-failing'))).toBe(false);
    expect(storage.deletedCaches).toContain(
      getStagingCacheName('tour-failing'),
    );

    // L'ancienne version en cache définitif est restée STRICTEMENT intacte
    const prodCache = storage.caches.get(getTourCacheName('tour-failing'));
    expect(prodCache).toBeDefined();
    if (prodCache !== undefined) {
      expect(await prodCache.keys()).toEqual(['/tours/tour-failing/v1.json']);
    }

    // L'index conserve la version 1
    expect(await cache.versions()).toEqual({ 'tour-failing': 1 });
    expect(index.setCalls).toEqual([]);
  });

  it('lève une erreur et supprime le staging quand fetchFn renvoie une réponse HTTP d’erreur (404/500)', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex();

    const fetchFn = (url: string): Promise<unknown> => {
      if (url.includes('not-found')) {
        return Promise.resolve({ ok: false, status: 404 });
      }
      return Promise.resolve({ ok: true, status: 200 });
    };

    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn,
      urlsForTour: () => [
        '/tours/tour-http/ok.jpg',
        '/tours/tour-http/not-found.jpg',
      ],
    });

    await expect(cache.downloadTour('tour-http')).rejects.toThrow(
      "Échec du téléchargement pour l'URL",
    );

    expect(storage.caches.has(getStagingCacheName('tour-http'))).toBe(false);
    expect(storage.caches.has(getTourCacheName('tour-http'))).toBe(false);
  });

  it('supprime le staging si l’écriture dans le cache (put) échoue', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex();

    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn: () => Promise.resolve({ content: 'ok' }),
      urlsForTour: () => ['/asset.jpg'],
    });

    const stagingCache = await storage.open(getStagingCacheName('tour-put-fail'));
    stagingCache.shouldFailPut = true;

    await expect(cache.downloadTour('tour-put-fail')).rejects.toThrow(
      "Erreur d'écriture",
    );

    expect(storage.caches.has(getStagingCacheName('tour-put-fail'))).toBe(false);
  });

  it('purge le cache et l’entrée d’index via purgeTour', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex({ 'tour-to-purge': 1 });

    const prodCache = await storage.open(getTourCacheName('tour-to-purge'));
    await prodCache.put('/tours/tour-to-purge/scene.jpg', { ready: true });

    const stagingCache = await storage.open(
      getStagingCacheName('tour-to-purge'),
    );
    await stagingCache.put('/tours/tour-to-purge/leftover.jpg', { ready: true });

    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn: () => Promise.resolve({}),
      urlsForTour: () => [],
    });

    await cache.purgeTour('tour-to-purge');

    // Les caches sont supprimés
    expect(storage.caches.has(getTourCacheName('tour-to-purge'))).toBe(false);
    expect(storage.caches.has(getStagingCacheName('tour-to-purge'))).toBe(false);
    expect(storage.deletedCaches).toContain(getTourCacheName('tour-to-purge'));
    expect(storage.deletedCaches).toContain(getStagingCacheName('tour-to-purge'));

    // L'entrée d'index est retirée
    expect(await cache.versions()).toEqual({});
    expect(index.removeCalls).toEqual(['tour-to-purge']);
  });

  it('fonctionne avec un CacheStorage minimal qui ne fournit pas de méthode delete(name)', async () => {
    const fakeCaches = new Map<string, FakeCacheEntry>();

    // CacheStorage sans méthode delete(name)
    const minimalCacheStorage: CacheStorageLike = {
      open(name: string): Promise<FakeCacheEntry> {
        let c = fakeCaches.get(name);
        if (c === undefined) {
          c = new FakeCacheEntry();
          fakeCaches.set(name, c);
        }
        return Promise.resolve(c);
      },
    };

    const index = new FakeTourCacheIndex();
    const cache = createTourCache({
      index,
      cacheStorage: minimalCacheStorage,
      fetchFn: (url) => Promise.resolve({ url }),
      urlsForTour: () => ['/file1.jpg', '/file2.jpg'],
    });

    await cache.downloadTour('tour-min');
    await cache.commitTour('tour-min', 1);

    const prod = fakeCaches.get(getTourCacheName('tour-min'));
    expect(prod).toBeDefined();
    if (prod !== undefined) {
      expect(await prod.keys()).toEqual(['/file1.jpg', '/file2.jpg']);
    }

    // Le cache staging a été vidé de ses entrées
    const staging = fakeCaches.get(getStagingCacheName('tour-min'));
    expect(staging).toBeDefined();
    if (staging !== undefined) {
      expect(await staging.keys()).toEqual([]);
    }

    // Purge vide également les entrées du cache cible
    await cache.purgeTour('tour-min');
    if (prod !== undefined) {
      expect(await prod.keys()).toEqual([]);
    }
    expect(await cache.versions()).toEqual({});
  });

  it('clone les objets Response pour éviter l’erreur de corps déjà consommé', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex();

    let cloneCallCount = 0;
    const mockResponse = {
      ok: true,
      status: 200,
      clone() {
        cloneCallCount += 1;
        return { ok: true, status: 200, cloned: true };
      },
    };

    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn: () => Promise.resolve(mockResponse),
      urlsForTour: () => ['/response-clone.jpg'],
    });

    await cache.downloadTour('tour-clone');
    expect(cloneCallCount).toBeGreaterThan(0);

    await cache.commitTour('tour-clone', 1);
    expect(await cache.versions()).toEqual({ 'tour-clone': 1 });
  });

  it('valide strictement les identifiants et versions avec Zod', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex();

    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn: () => Promise.resolve({}),
      urlsForTour: () => ['/asset.jpg'],
    });

    await expect(cache.downloadTour('')).rejects.toThrow();
    await expect(cache.commitTour('', 1)).rejects.toThrow();
    await expect(cache.commitTour('tour-1', 1.5)).rejects.toThrow();
    await expect(cache.purgeTour('')).rejects.toThrow();
  });

  it('s’intègre parfaitement avec runSync (nouveau téléchargé, échec réseau conservé, retiré purgé)', async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeTourCacheIndex({
      'tour-kept': 1,
      'tour-failing': 1,
      'tour-to-remove': 2,
    });

    // Préparer les caches existants
    const keptCache = await storage.open(getTourCacheName('tour-kept'));
    await keptCache.put('/tours/tour-kept/data.json', { kept: true });

    const failingCache = await storage.open(getTourCacheName('tour-failing'));
    await failingCache.put('/tours/tour-failing/v1.json', { version: 1 });

    const removedCache = await storage.open(getTourCacheName('tour-to-remove'));
    await removedCache.put('/tours/tour-to-remove/old.json', { old: true });

    const fetchFn = (url: string): Promise<unknown> => {
      if (url.includes('failing')) {
        return Promise.reject(new Error('Network error on tour-failing'));
      }
      return Promise.resolve({ url, ok: true });
    };

    const urlsMap: Record<string, string[]> = {
      'tour-new': ['/tours/tour-new/meta.json'],
      'tour-kept': ['/tours/tour-kept/data.json'],
      'tour-failing': ['/tours/tour-failing/v2.json'],
    };

    const cache = createTourCache({
      index,
      cacheStorage: storage,
      fetchFn,
      urlsForTour: (id) => urlsMap[id] ?? [],
    });

    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [
          {
            id: 'tour-kept',
            contentVersion: 1,
            sizeBytes: 100,
            url: '/api/v1/tours/tour-kept',
          },
          {
            id: 'tour-new',
            contentVersion: 1,
            sizeBytes: 100,
            url: '/api/v1/tours/tour-new',
          },
          {
            id: 'tour-failing',
            contentVersion: 2,
            sizeBytes: 200,
            url: '/api/v1/tours/tour-failing',
          },
        ],
      },
    };

    const result = await runSync({ manifest, cache });

    expect(result).toEqual({
      downloaded: ['tour-new'],
      removed: ['tour-to-remove'],
      failed: ['tour-failing'],
    });

    // tour-new est dans le cache et indexé
    const newCache = storage.caches.get(getTourCacheName('tour-new'));
    expect(newCache).toBeDefined();
    if (newCache !== undefined) {
      expect(await newCache.keys()).toEqual(['/tours/tour-new/meta.json']);
    }

    // tour-failing a conservé sa version 1
    const failingAfter = storage.caches.get(getTourCacheName('tour-failing'));
    expect(failingAfter).toBeDefined();
    if (failingAfter !== undefined) {
      expect(await failingAfter.keys()).toEqual(['/tours/tour-failing/v1.json']);
    }

    // tour-to-remove a été purgé
    expect(storage.caches.has(getTourCacheName('tour-to-remove'))).toBe(false);

    // État final des versions dans l'index
    expect(await cache.versions()).toEqual({
      'tour-kept': 1,
      'tour-new': 1,
      'tour-failing': 1,
    });
  });
});
