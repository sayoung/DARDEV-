import type { KioskManifest, KioskManifestTour } from '@xplor/shared';

export interface SyncPlan {
  toDownload: KioskManifestTour[];
  toPurge: string[];
  upToDate: string[];
}

/** Compare le manifeste reçu avec les versions de visites présentes en cache. */
export function planSync(
  cached: Record<string, number>,
  manifest: KioskManifest,
): SyncPlan {
  const manifestTourIds = new Set(manifest.selection.tours.map((tour) => tour.id));
  const toDownload: KioskManifestTour[] = [];
  const upToDate: string[] = [];

  for (const tour of manifest.selection.tours) {
    if (cached[tour.id] === tour.contentVersion) {
      upToDate.push(tour.id);
    } else {
      toDownload.push(tour);
    }
  }

  const toPurge = Object.keys(cached).filter((tourId) => !manifestTourIds.has(tourId));

  return { toDownload, toPurge, upToDate };
}
