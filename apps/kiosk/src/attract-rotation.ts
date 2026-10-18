import type { KioskManifest } from '@xplor/shared';

export interface AttractRotation {
  next(): string | null;
}

/**
 * Crée un itérateur cyclique sur les visites du mode veille (`selection.attractTourIds`) (F-63).
 *
 * - Ignore les identifiants absents de `selection.tours`.
 * - Renvoie `null` si la liste filtrée est vide.
 * - Fait tourner cycliquement sur la liste filtrée dans l'ordre défini.
 */
export function createAttractRotation(manifest: KioskManifest): AttractRotation {
  const availableTourIds = new Set(manifest.selection.tours.map((tour) => tour.id));
  const validAttractTourIds = manifest.selection.attractTourIds.filter((tourId) =>
    availableTourIds.has(tourId),
  );

  let currentIndex = 0;

  return {
    next(): string | null {
      if (validAttractTourIds.length === 0) {
        return null;
      }

      const tourId = validAttractTourIds[currentIndex];
      if (tourId === undefined) {
        return null;
      }

      currentIndex = (currentIndex + 1) % validAttractTourIds.length;
      return tourId;
    },
  };
}
