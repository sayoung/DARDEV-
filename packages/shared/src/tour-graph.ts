import { z } from 'zod';
import { HotspotType, HotspotIcon } from './catalog.js';
import { LANGS } from './lang.js';

export const TourGraphHotspotSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(HotspotType.SCENE_LINK),
    id: z.string(),
    yaw: z.number(),
    pitch: z.number(),
    label: z.string(),
    icon: z.enum(HotspotIcon),
    targetSceneId: z.string(),
    arrivalYaw: z.number().nullable(),
  }),
  z.object({
    type: z.literal(HotspotType.TOUR_LINK),
    id: z.string(),
    yaw: z.number(),
    pitch: z.number(),
    label: z.string(),
    icon: z.enum(HotspotIcon),
    targetTourId: z.string(),
    targetSceneId: z.string().nullable(),
    arrivalYaw: z.number().nullable(),
  }),
  z.object({
    type: z.literal(HotspotType.INFO),
    id: z.string(),
    yaw: z.number(),
    pitch: z.number(),
    label: z.string(),
    icon: z.enum(HotspotIcon),
    bodyHtml: z.string(),
    images: z.array(z.string()),
  }),
  z.object({
    type: z.literal(HotspotType.MEDIA),
    id: z.string(),
    yaw: z.number(),
    pitch: z.number(),
    label: z.string(),
    icon: z.enum(HotspotIcon),
    media: z.array(z.object({
      url: z.string(),
      mimeType: z.string()
    })).min(1),
  }),
  z.object({
    type: z.literal(HotspotType.URL),
    id: z.string(),
    yaw: z.number(),
    pitch: z.number(),
    label: z.string(),
    icon: z.enum(HotspotIcon),
    url: z.httpUrl(), // http/https uniquement
  }),
]);

export type TourGraphHotspot = z.infer<typeof TourGraphHotspotSchema>;

export const TourGraphSceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  caption: z.string().nullable(),
  panorama: z.object({
    preview: z.string(),
    web: z.string(),
    tiles: z.object({
      width: z.number(),
      cols: z.number(),
      rows: z.number(),
      baseUrl: z.string(),
    }),
  }),
  initialView: z.object({
    yaw: z.number(),
    pitch: z.number(),
    zoom: z.number(),
  }),
  narrationUrl: z.string().nullable(),
  ambientUrl: z.string().nullable(),
  thumb: z.string(),
  hotspots: z.array(TourGraphHotspotSchema),
});

export type TourGraphScene = z.infer<typeof TourGraphSceneSchema>;

export const TourGraphSchema = z.object({
  id: z.string(),
  contentVersion: z.number(),
  lang: z.enum(LANGS),
  title: z.string(),
  summary: z.string(),
  city: z.string(),
  categories: z.array(z.string()),
  coverUrl: z.string().nullable(),
  practicalInfo: z.string().nullable(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).nullable(),
  startSceneId: z.string(),
  scenes: z.array(TourGraphSceneSchema).min(1),
  linkedTours: z.array(z.object({
    id: z.string(),
    title: z.string(),
    coverUrl: z.string().nullable(),
    availableOffline: z.boolean(),
  })),
});

export type TourGraph = z.infer<typeof TourGraphSchema>;
