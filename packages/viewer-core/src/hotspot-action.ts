import { TourGraphScene, HotspotType } from '@xplor/shared';

export type HotspotAction =
  | { kind: 'info'; title: string; bodyHtml: string; images: string[] }
  | { kind: 'media'; title: string; media: { url: string; mimeType: string }[] }
  | { kind: 'url'; url: string }
  | { kind: 'tour'; hotspotId: string };

export function hotspotAction(scene: TourGraphScene, hotspotId: string): HotspotAction | null {
  const hotspot = scene.hotspots.find(h => h.id === hotspotId);
  if (!hotspot) {
    return null;
  }

  switch (hotspot.type) {
    case HotspotType.SCENE_LINK:
      return null;
    case HotspotType.INFO:
      return {
        kind: 'info',
        title: hotspot.label,
        bodyHtml: hotspot.bodyHtml,
        images: hotspot.images,
      };
    case HotspotType.MEDIA:
      return {
        kind: 'media',
        title: hotspot.label,
        media: hotspot.media,
      };
    case HotspotType.URL:
      return {
        kind: 'url',
        url: hotspot.url,
      };
    case HotspotType.TOUR_LINK:
      return {
        kind: 'tour',
        hotspotId: hotspot.id,
      };
    default:
      return null;
  }
}
