import {
  LocalizedTextSchema,
  localize,
  TourGraph,
  TourGraphSchema,
} from '@xplor/shared';
import { SceneSource, SceneCtx, toGraphScene } from './tour-graph-scene.js';
import { panoramaUrls } from './media-url.js';

export type TourSource = {
  id: string;
  contentVersion: number;
  title: unknown;
  summary: unknown;
  practicalInfo: unknown;
  startSceneId: string | null;
  lat: number | null;
  lng: number | null;
  city: { name: unknown } | null;
  categories: { category: { name: unknown } }[];
  coverAsset: { derivatives: unknown } | null;
  scenes: SceneSource[];
  linkedTours: {
    id: string;
    title: unknown;
    coverAsset: { derivatives: unknown } | null;
  }[];
};

export function toTourGraph(source: TourSource, ctx: SceneCtx): TourGraph {
  if (!source.startSceneId) {
    throw new Error('startSceneId is required');
  }

  const parsedTitle = LocalizedTextSchema.safeParse(source.title);
  const title = parsedTitle.success ? localize(parsedTitle.data, ctx.lang) : '';

  const parsedSummary = LocalizedTextSchema.safeParse(source.summary);
  const summary = parsedSummary.success ? localize(parsedSummary.data, ctx.lang) : '';

  let city = '';
  if (source.city) {
    const parsedCity = LocalizedTextSchema.safeParse(source.city.name);
    if (parsedCity.success) {
      city = localize(parsedCity.data, ctx.lang);
    }
  }

  const categories = source.categories.map((c) => {
    const parsedCat = LocalizedTextSchema.safeParse(c.category.name);
    return parsedCat.success ? localize(parsedCat.data, ctx.lang) : '';
  }).filter(c => c !== '');

  let practicalInfo: string | null = null;
  const parsedPractical = LocalizedTextSchema.safeParse(source.practicalInfo);
  if (parsedPractical.success) {
    const info = localize(parsedPractical.data, ctx.lang);
    if (info) {
      practicalInfo = info;
    }
  }

  let coverUrl: string | null = null;
  if (source.coverAsset) {
    try {
      const pano = panoramaUrls(ctx.mediaBase, source.coverAsset.derivatives);
      coverUrl = pano.thumb;
    } catch {
      // Ignorer les erreurs de format
    }
  }

  const location = source.lat !== null && source.lng !== null
    ? { lat: source.lat, lng: source.lng }
    : null;

  const scenes = source.scenes.map(s => toGraphScene(s, ctx));

  const linkedTours = source.linkedTours.map(t => {
    const parsedTTitle = LocalizedTextSchema.safeParse(t.title);
    const tTitle = parsedTTitle.success ? localize(parsedTTitle.data, ctx.lang) : '';

    let tCoverUrl: string | null = null;
    if (t.coverAsset) {
      try {
        const pano = panoramaUrls(ctx.mediaBase, t.coverAsset.derivatives);
        tCoverUrl = pano.thumb;
      } catch {
        // Ignorer les erreurs de format
      }
    }

    let availableOffline = false;
    if (ctx.audience === 'kiosk' && ctx.allowedTourIds && ctx.allowedTourIds.has(t.id)) {
      availableOffline = true;
    }

    return {
      id: t.id,
      title: tTitle,
      coverUrl: tCoverUrl,
      availableOffline,
    };
  });

  return TourGraphSchema.parse({
    id: source.id,
    contentVersion: source.contentVersion,
    lang: ctx.lang,
    title,
    summary,
    city,
    categories,
    coverUrl,
    practicalInfo,
    location,
    startSceneId: source.startSceneId,
    scenes,
    linkedTours,
  });
}
