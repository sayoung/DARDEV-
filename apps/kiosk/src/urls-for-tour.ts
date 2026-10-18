import {
  HotspotType,
  TourGraphSchema,
  type Lang,
  type TourGraph,
} from '@xplor/shared';
import { fetchTourGraph } from '@xplor/viewer-core';

import type { UrlsForTour } from './tour-cache.js';

/**
 * Extrait toutes les URLs associées à une visite 360° (manifeste, couverture,
 * panoramas, tuiles et médias de hotspots) à partir de son graphe TourGraph validé.
 *
 * Renvoie un tableau d'URLs sans doublon et sans chaîne vide.
 */
export function collectUrlsFromTourGraph(
  graph: TourGraph,
  manifestUrl?: string,
): string[] {
  const validGraph = TourGraphSchema.parse(graph);
  const urls = new Set<string>();

  if (typeof manifestUrl === 'string') {
    const trimmedManifest = manifestUrl.trim();
    if (trimmedManifest.length > 0) {
      urls.add(trimmedManifest);
    }
  }

  if (typeof validGraph.coverUrl === 'string') {
    const trimmedCover = validGraph.coverUrl.trim();
    if (trimmedCover.length > 0) {
      urls.add(trimmedCover);
    }
  }

  for (const scene of validGraph.scenes) {
    const trimmedThumb = scene.thumb.trim();
    if (trimmedThumb.length > 0) {
      urls.add(trimmedThumb);
    }

    if (typeof scene.narrationUrl === 'string') {
      const trimmedNarration = scene.narrationUrl.trim();
      if (trimmedNarration.length > 0) {
        urls.add(trimmedNarration);
      }
    }

    if (typeof scene.ambientUrl === 'string') {
      const trimmedAmbient = scene.ambientUrl.trim();
      if (trimmedAmbient.length > 0) {
        urls.add(trimmedAmbient);
      }
    }

    const trimmedPreview = scene.panorama.preview.trim();
    if (trimmedPreview.length > 0) {
      urls.add(trimmedPreview);
    }

    const trimmedWeb = scene.panorama.web.trim();
    if (trimmedWeb.length > 0) {
      urls.add(trimmedWeb);
    }

    const { cols, rows, baseUrl } = scene.panorama.tiles;
    const cleanBaseUrl = baseUrl.trim();
    if (cleanBaseUrl.length > 0) {
      if (cleanBaseUrl.includes('{col}') && cleanBaseUrl.includes('{row}')) {
        const colCount = Math.max(0, Math.floor(cols));
        const rowCount = Math.max(0, Math.floor(rows));
        for (let col = 0; col < colCount; col++) {
          for (let row = 0; row < rowCount; row++) {
            const tileUrl = cleanBaseUrl
              .replaceAll('{col}', col.toString())
              .replaceAll('{row}', row.toString())
              .trim();
            if (tileUrl.length > 0) {
              urls.add(tileUrl);
            }
          }
        }
      } else {
        urls.add(cleanBaseUrl);
      }
    }

    for (const hotspot of scene.hotspots) {
      if (hotspot.type === HotspotType.INFO) {
        for (const image of hotspot.images) {
          const trimmedImage = image.trim();
          if (trimmedImage.length > 0) {
            urls.add(trimmedImage);
          }
        }
      } else if (hotspot.type === HotspotType.MEDIA) {
        for (const item of hotspot.media) {
          const trimmedMediaUrl = item.url.trim();
          if (trimmedMediaUrl.length > 0) {
            urls.add(trimmedMediaUrl);
          }
        }
      }
    }
  }

  return Array.from(urls);
}

export interface CreateUrlsForTourDeps {
  baseUrl: string;
  lang: () => Lang;
  fetchFn: typeof fetch;
  manifestUrlFor?: (tourId: string) => string | undefined;
}

/**
 * Fabrique la fonction `urlsForTour` consommée par le cache de visites (M5 F-62 / F-61).
 *
 * Elle appelle `fetchTourGraph(baseUrl, tourId, lang(), fetchFn)` de @xplor/viewer-core,
 * puis renvoie `collectUrlsFromTourGraph(graph, manifestUrlFor?.(tourId))`.
 */
export function createUrlsForTour(deps: {
  baseUrl: string;
  lang: () => Lang;
  fetchFn: typeof fetch;
  manifestUrlFor?: (tourId: string) => string | undefined;
}): UrlsForTour {
  return async (tourId: string): Promise<string[]> => {
    const graph = await fetchTourGraph(
      deps.baseUrl,
      tourId,
      deps.lang(),
      deps.fetchFn,
    );
    const manifestUrl = deps.manifestUrlFor?.(tourId);
    return collectUrlsFromTourGraph(graph, manifestUrl);
  };
}
