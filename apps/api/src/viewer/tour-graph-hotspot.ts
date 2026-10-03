import {
  LocalizedTextSchema,
  localize,
  TourGraphHotspot,
  TourGraphHotspotSchema,
  Lang,
  HotspotType,
} from '@xplor/shared';

export type HotspotRow = {
  id: string;
  type: 'SCENE_LINK' | 'TOUR_LINK' | 'INFO' | 'MEDIA' | 'URL';
  yaw: number;
  pitch: number;
  label: unknown;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
  body: unknown;
  mediaAssetIds: string[];
  url: string | null;
  icon: string | null;
  arrivalYaw: number | null;
};

export type HotspotCtx = {
  lang: Lang;
  audience: 'public' | 'kiosk';
  allowedTourIds?: ReadonlySet<string>;
  media: ReadonlyMap<string, { url: string; mimeType: string }>;
};

export function toGraphHotspot(row: HotspotRow, ctx: HotspotCtx): TourGraphHotspot | null {
  const parsedLabel = LocalizedTextSchema.safeParse(row.label);
  if (!parsedLabel.success) {
    return null;
  }
  
  const localizedLabel = localize(parsedLabel.data, ctx.lang);

  switch (row.type) {
    case 'SCENE_LINK':
      if (!row.targetSceneId) {
        return null;
      }
      return TourGraphHotspotSchema.parse({
        type: HotspotType.SCENE_LINK,
        id: row.id,
        yaw: row.yaw,
        pitch: row.pitch,
        label: localizedLabel,
        icon: row.icon ?? 'ARROW', // fallback if null, assuming ARROW makes sense or let Zod validate it
        targetSceneId: row.targetSceneId,
        arrivalYaw: row.arrivalYaw,
      });

    case 'INFO': {
      let bodyHtml = '';
      const parsedBody = LocalizedTextSchema.safeParse(row.body);
      if (parsedBody.success) {
        const localizedBody = localize(parsedBody.data, ctx.lang);
        const escaped = localizedBody
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        
        const paragraphs = escaped.split(/\r?\n\s*\r?\n/);
        const htmlParagraphs = paragraphs
          .map(p => p.trim())
          .filter(p => p.length > 0)
          .map(p => `<p>${p}</p>`);
        
        bodyHtml = htmlParagraphs.join('');
      }

      return TourGraphHotspotSchema.parse({
        type: HotspotType.INFO,
        id: row.id,
        yaw: row.yaw,
        pitch: row.pitch,
        label: localizedLabel,
        icon: row.icon ?? 'INFO',
        bodyHtml,
        images: [],
      });
    }

    case 'MEDIA': {
      const mediaList: {url: string, mimeType: string}[] = [];
      for (const assetId of row.mediaAssetIds) {
        const asset = ctx.media.get(assetId);
        if (asset) {
          mediaList.push(asset);
        }
      }

      if (mediaList.length === 0) {
        return null;
      }

      return TourGraphHotspotSchema.parse({
        type: HotspotType.MEDIA,
        id: row.id,
        yaw: row.yaw,
        pitch: row.pitch,
        label: localizedLabel,
        icon: row.icon ?? 'PHOTO',
        media: mediaList,
      });
    }

    case 'TOUR_LINK': {
      if (!row.targetTourId) {
        return null;
      }
      if (ctx.audience === 'kiosk' && (!ctx.allowedTourIds || !ctx.allowedTourIds.has(row.targetTourId))) {
        return null;
      }
      return TourGraphHotspotSchema.parse({
        type: HotspotType.TOUR_LINK,
        id: row.id,
        yaw: row.yaw,
        pitch: row.pitch,
        label: localizedLabel,
        icon: row.icon ?? 'PORTAL',
        targetTourId: row.targetTourId,
        targetSceneId: row.targetTourSceneId,
        arrivalYaw: row.arrivalYaw,
      });
    }

    case 'URL': {
      if (ctx.audience === 'kiosk') {
        return null;
      }
      if (!row.url) {
        return null;
      }
      const parsed = TourGraphHotspotSchema.safeParse({
        type: HotspotType.URL,
        id: row.id,
        yaw: row.yaw,
        pitch: row.pitch,
        label: localizedLabel,
        icon: row.icon ?? 'INFO',
        url: row.url,
      });
      if (!parsed.success) {
        return null;
      }
      return parsed.data;
    }
      
    default:
      return null;
  }
}
