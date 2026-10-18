import type { KioskManifest } from '@xplor/shared';

import { planSync } from './sync-plan.js';

export interface SyncCache {
  versions(): Promise<Record<string, number>>;
  downloadTour(tourId: string): Promise<void>;
  commitTour(tourId: string, contentVersion: number): Promise<void>;
  purgeTour(tourId: string): Promise<void>;
}

export interface SyncRunnerDeps {
  manifest: KioskManifest;
  cache: SyncCache;
}

export interface SyncResult {
  downloaded: string[];
  removed: string[];
  failed: string[];
}

/**
 * Exécute la synchronisation hors-ligne du kiosque (F-62).
 *
 * 1. Lit les versions en cache via `deps.cache.versions()`.
 * 2. Calcule le plan de synchronisation via `planSync`.
 * 3. Pour chaque visite à télécharger : exécute `downloadTour` puis `commitTour`
 *    (bascule atomique : `commitTour` n'est appelé qu'après un `downloadTour` réussi).
 *    En cas d'échec, la visite est ajoutée à `failed`, l'ancienne version en cache
 *    est conservée et la synchronisation continue pour les autres visites.
 * 4. Pour chaque visite retirée : exécute `purgeTour`.
 * 5. Retourne le bilan `{ downloaded, removed, failed }`.
 */
export async function runSync(deps: SyncRunnerDeps): Promise<SyncResult> {
  const cachedVersions = await deps.cache.versions();
  const plan = planSync(cachedVersions, deps.manifest);

  const downloaded: string[] = [];
  const removed: string[] = [];
  const failed: string[] = [];

  for (const tour of plan.toDownload) {
    try {
      await deps.cache.downloadTour(tour.id);
      await deps.cache.commitTour(tour.id, tour.contentVersion);
      downloaded.push(tour.id);
    } catch {
      failed.push(tour.id);
    }
  }

  for (const tourId of plan.toPurge) {
    try {
      await deps.cache.purgeTour(tourId);
      removed.push(tourId);
    } catch {
      failed.push(tourId);
    }
  }

  return {
    downloaded,
    removed,
    failed,
  };
}
