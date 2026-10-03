import {
  LocalizedTextSchema,
  localize,
  TourGraphScene,
  TourGraphSceneSchema,
} from '@xplor/shared';
import { HotspotRow, HotspotCtx, toGraphHotspot } from './tour-graph-hotspot.js';
import { panoramaUrls } from './media-url.js';

export type SceneSource = {
  id: string;
  title: unknown;
  caption: unknown;
  weight: number;
  initialYaw: number;
  initialPitch: number;
  initialZoom: number;
  panoramaAsset: { derivatives: unknown };
  ambientAsset: { id: string } | null;
  narration: unknown;
  hotspots: HotspotRow[];
};

export type SceneCtx = HotspotCtx & {
  mediaBase: string;
  assetUrlById: ReadonlyMap<string, string>;
};

export function toGraphScene(scene: SceneSource, ctx: SceneCtx): TourGraphScene {
  const parsedTitle = LocalizedTextSchema.safeParse(scene.title);
  const title = parsedTitle.success ? localize(parsedTitle.data, ctx.lang) : '';

  let caption: string | null = null;
  const parsedCaption = LocalizedTextSchema.safeParse(scene.caption);
  if (parsedCaption.success) {
    const locCaption = localize(parsedCaption.data, ctx.lang);
    if (locCaption) {
      caption = locCaption;
    }
  }

  const pano = panoramaUrls(ctx.mediaBase, scene.panoramaAsset.derivatives);

  let narrationUrl: string | null = null;
  const parsedNarration = LocalizedTextSchema.safeParse(scene.narration);
  if (parsedNarration.success) {
    const narrationId = localize(parsedNarration.data, ctx.lang);
    if (narrationId) {
      narrationUrl = ctx.assetUrlById.get(narrationId) ?? null;
    }
  }

  const ambientUrl = scene.ambientAsset ? (ctx.assetUrlById.get(scene.ambientAsset.id) ?? null) : null;

  const hotspots = scene.hotspots
    .map(h => toGraphHotspot(h, ctx))
    .filter((h): h is NonNullable<typeof h> => h !== null);

  return TourGraphSceneSchema.parse({
    id: scene.id,
    title,
    caption,
    panorama: {
      preview: pano.preview,
      web: pano.web,
      tiles: pano.tiles,
    },
    initialView: {
      yaw: scene.initialYaw,
      pitch: scene.initialPitch,
      zoom: scene.initialZoom,
    },
    narrationUrl,
    ambientUrl,
    thumb: pano.thumb,
    hotspots,
  });
}
