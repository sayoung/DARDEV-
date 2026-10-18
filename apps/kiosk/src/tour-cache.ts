import { z } from '@xplor/shared';

import type { SyncCache } from './sync-runner.js';
import type { TourCacheIndex } from './tour-cache-index.js';

export interface CacheEntryLike {
  put(url: string, response: unknown): Promise<void>;
  delete(url: string): Promise<boolean>;
  keys(): Promise<string[]>;
  match?(url: string): Promise<unknown>;
}

export interface CacheStorageLike {
  open(name: string): Promise<CacheEntryLike>;
  delete?(name: string): Promise<boolean>;
}

export type FetchFn = (url: string) => Promise<unknown>;

export type UrlsForTour = (tourId: string) => string[] | Promise<string[]>;

export interface TourCacheDeps {
  index: TourCacheIndex;
  cacheStorage: CacheStorageLike;
  fetchFn: FetchFn;
  urlsForTour: UrlsForTour;
}

export type TourCache = SyncCache;

export function getTourCacheName(tourId: string): string {
  return `tour-${tourId}`;
}

export function getStagingCacheName(tourId: string): string {
  return `tour-${tourId}-staging`;
}

interface Cloneable {
  clone: () => unknown;
}

function isCloneable(value: unknown): value is Cloneable {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('clone' in value)) {
    return false;
  }
  return typeof value.clone === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isResponseFailed(response: unknown): boolean {
  if (isRecord(response)) {
    if ('ok' in response && typeof response.ok === 'boolean' && !response.ok) {
      return true;
    }
    if (
      'status' in response &&
      typeof response.status === 'number' &&
      (response.status < 200 || response.status >= 400)
    ) {
      return true;
    }
  }
  return false;
}

function cloneResponseIfPossible(response: unknown): unknown {
  if (isCloneable(response)) {
    try {
      return response.clone();
    } catch {
      return response;
    }
  }
  return response;
}

async function clearCacheEntries(cache: CacheEntryLike): Promise<void> {
  const keys = await cache.keys();
  for (const key of keys) {
    await cache.delete(key);
  }
}

async function deleteCacheByName(
  name: string,
  cacheStorage: CacheStorageLike,
  cache: CacheEntryLike,
): Promise<void> {
  try {
    await clearCacheEntries(cache);
  } catch {
    // ignorer si vider les clés échoue
  }
  if (typeof cacheStorage.delete === 'function') {
    try {
      await cacheStorage.delete(name);
    } catch {
      // ignorer si delete échoue
    }
  }
}

/**
 * Gestionnaire du cache hors-ligne des visites du kiosque (M5 F-62).
 *
 * Implémente l'interface `SyncCache` consommée par `runSync` :
 * - `downloadTour(tourId)` : télécharge toutes les URLs fournies par `urlsForTour`
 *   dans un cache temporaire nommé `tour-<id>-staging`. En cas d'échec sur une URL,
 *   une erreur est levée et le cache staging est intégralement supprimé.
 * - `commitTour(tourId, contentVersion)` : bascule le contenu de staging vers le cache
 *   définitif `tour-<id>` (en remplaçant toute version antérieure), supprime le staging,
 *   puis enregistre la nouvelle version dans l'index via `index.set`.
 * - `purgeTour(tourId)` : supprime le cache `tour-<id>` (et staging s'il en reste),
 *   puis supprime la visite de l'index via `index.remove`.
 * - `versions()` : renvoie les versions en cache via `index.versions()`.
 */
export function createTourCache(deps: TourCacheDeps): TourCache {
  const stagingResponses = new Map<string, Map<string, unknown>>();

  function versions(): Promise<Record<string, number>> {
    return deps.index.versions();
  }

  async function downloadTour(tourId: string): Promise<void> {
    const validTourId = z.string().min(1).parse(tourId);
    const urls = await deps.urlsForTour(validTourId);
    const validUrls = z.array(z.string().min(1)).parse(urls);

    const stagingName = getStagingCacheName(validTourId);
    const stagingCache = await deps.cacheStorage.open(stagingName);

    // Nettoyage préalable pour garantir un staging vide avant téléchargement
    await clearCacheEntries(stagingCache);
    stagingResponses.delete(validTourId);

    const downloaded = new Map<string, unknown>();

    try {
      for (const url of validUrls) {
        const response = await deps.fetchFn(url);
        if (isResponseFailed(response)) {
          throw new Error(
            `Échec du téléchargement pour l'URL ${url} (visite ${validTourId})`,
          );
        }
        const responseForCache = cloneResponseIfPossible(response);
        const responseToStore = cloneResponseIfPossible(response);
        await stagingCache.put(url, responseForCache);
        downloaded.set(url, responseToStore);
      }
      stagingResponses.set(validTourId, downloaded);
    } catch (error) {
      // Échec d'une URL -> staging supprimé
      stagingResponses.delete(validTourId);
      await deleteCacheByName(stagingName, deps.cacheStorage, stagingCache);
      throw error;
    }
  }

  async function commitTour(
    tourId: string,
    contentVersion: number,
  ): Promise<void> {
    const validTourId = z.string().min(1).parse(tourId);
    const validVersion = z.number().int().parse(contentVersion);

    const stagingName = getStagingCacheName(validTourId);
    const targetName = getTourCacheName(validTourId);

    const targetCache = await deps.cacheStorage.open(targetName);
    const stagingCache = await deps.cacheStorage.open(stagingName);

    // 1. Remplace l'ancien : vider le cache cible existant
    await clearCacheEntries(targetCache);

    // 2. Transférer les entrées de staging vers le cache cible
    const inMemory = stagingResponses.get(validTourId);
    const stagingKeys = await stagingCache.keys();

    const keysToTransfer = new Set<string>(stagingKeys);
    if (inMemory !== undefined) {
      for (const key of inMemory.keys()) {
        keysToTransfer.add(key);
      }
    }

    for (const key of keysToTransfer) {
      let response: unknown = inMemory?.get(key);
      if (response === undefined && typeof stagingCache.match === 'function') {
        response = await stagingCache.match(key);
      }
      const responseForTarget = cloneResponseIfPossible(response);
      await targetCache.put(key, responseForTarget);
    }

    // 3. Supprimer le cache staging après la bascule
    stagingResponses.delete(validTourId);
    await deleteCacheByName(stagingName, deps.cacheStorage, stagingCache);

    // 4. Mettre à jour l'index des versions
    await deps.index.set(validTourId, validVersion);
  }

  async function purgeTour(tourId: string): Promise<void> {
    const validTourId = z.string().min(1).parse(tourId);

    const targetName = getTourCacheName(validTourId);
    const stagingName = getStagingCacheName(validTourId);

    stagingResponses.delete(validTourId);

    // Supprimer le cache de la visite
    const targetCache = await deps.cacheStorage.open(targetName);
    await deleteCacheByName(targetName, deps.cacheStorage, targetCache);

    // Supprimer le staging s'il subsiste
    const stagingCache = await deps.cacheStorage.open(stagingName);
    await deleteCacheByName(stagingName, deps.cacheStorage, stagingCache);

    // Supprimer l'entrée d'index
    await deps.index.remove(validTourId);
  }

  return {
    versions,
    downloadTour,
    commitTour,
    purgeTour,
  };
}
