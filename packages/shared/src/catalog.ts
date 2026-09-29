import { z } from 'zod';

import { LocalizedTextSchema, localizedText } from './localized-text.js';

/** Statut d'une visite (cahier, 5.2). Création en brouillon : D-26. */
export enum TourStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

/** Type de hotspot (cahier, 5.4). */
export enum HotspotType {
  SCENE_LINK = 'SCENE_LINK',
  TOUR_LINK = 'TOUR_LINK',
  INFO = 'INFO',
  MEDIA = 'MEDIA',
  URL = 'URL',
}

/** Icône de hotspot (cahier, 5.4). */
export enum HotspotIcon {
  ARROW = 'ARROW',
  INFO = 'INFO',
  PHOTO = 'PHOTO',
  PLAY = 'PLAY',
  PORTAL = 'PORTAL',
}

/** Nature d'un fichier média (cahier, 5.5). */
export enum AssetKind {
  PANORAMA = 'PANORAMA',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

/** État du traitement d'un média (cahier, 5.5). */
export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR',
}

/** Identifiants exposés par l'API : UUID v7 (cahier, section 5). */
const idSchema = z.uuidv7();

const yawSchema = z.number().min(-Math.PI).max(Math.PI);
const pitchSchema = z
  .number()
  .min(-Math.PI / 2)
  .max(Math.PI / 2);
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const cityShape = {
  name: LocalizedTextSchema,
  region: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
};

/** Corps de création d'une ville (API-25). */
export const CityCreateSchema = z.object(cityShape);
export type CityCreate = z.infer<typeof CityCreateSchema>;

/** Remplacement d'une ville : mêmes champs que la création. */
export const CityUpdateSchema = z.object(cityShape);
export type CityUpdate = z.infer<typeof CityUpdateSchema>;

/** Ville renvoyée par l'API. */
export const CityResponseSchema = z.object({
  id: idSchema,
  ...cityShape,
});
export type CityResponse = z.infer<typeof CityResponseSchema>;

const categoryShape = {
  name: LocalizedTextSchema,
  icon: z.string().min(1),
  color: hexColorSchema,
  weight: z.number().int(),
};

/** Corps de création d'une catégorie (API-25). */
export const CategoryCreateSchema = z.object(categoryShape);
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;

/** Remplacement d'une catégorie : mêmes champs que la création. */
export const CategoryUpdateSchema = z.object(categoryShape);
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;

/** Catégorie renvoyée par l'API. */
export const CategoryResponseSchema = z.object({
  id: idSchema,
  ...categoryShape,
});
export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;

const tourShape = {
  title: LocalizedTextSchema,
  summary: localizedText({ max: 500 }),
  description: LocalizedTextSchema.optional(),
  cityId: idSchema,
  categoryIds: z.array(idSchema).min(1),
  coverAssetId: idSchema,
  durationMinutes: z.number().int().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  practicalInfo: LocalizedTextSchema.optional(),
};

/** Corps de création d'une visite (API-21). Le statut n'est pas saisi : brouillon (D-26). */
export const TourCreateSchema = z.object(tourShape);
export type TourCreate = z.infer<typeof TourCreateSchema>;

/** Remplacement d'une visite : mêmes champs que la création. */
export const TourUpdateSchema = z.object(tourShape);
export type TourUpdate = z.infer<typeof TourUpdateSchema>;

const sceneShape = {
  title: LocalizedTextSchema,
  caption: LocalizedTextSchema.optional(),
  panoramaAssetId: idSchema,
  initialYaw: yawSchema.default(0),
  initialPitch: pitchSchema.default(0),
  initialZoom: z.number().int().min(0).max(100).default(50),
  weight: z.number().int(),
};

/** Corps de création d'une scène (API-22). */
export const SceneCreateSchema = z.object(sceneShape);
export type SceneCreate = z.infer<typeof SceneCreateSchema>;

/** Remplacement d'une scène : mêmes champs que la création. */
export const SceneUpdateSchema = z.object(sceneShape);
export type SceneUpdate = z.infer<typeof SceneUpdateSchema>;

const hotspotPosition = {
  yaw: yawSchema,
  pitch: pitchSchema,
  label: LocalizedTextSchema,
  arrivalYaw: yawSchema.optional(),
};

/**
 * Corps de création d'un hotspot (API-23).
 * `sceneId` vient de la route. L'union impose les champs du type (cahier, 5.4).
 * L'appartenance au graphe de la visite est vérifiée plus tard (F-03).
 * Icône par défaut : ARROW, PORTAL, INFO, PHOTO, INFO selon le type (D-67).
 */
export const HotspotCreateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(HotspotType.SCENE_LINK),
    ...hotspotPosition,
    targetSceneId: idSchema,
    icon: z.enum(HotspotIcon).default(HotspotIcon.ARROW),
  }),
  z.object({
    type: z.literal(HotspotType.TOUR_LINK),
    ...hotspotPosition,
    targetTourId: idSchema,
    targetTourSceneId: idSchema.optional(),
    icon: z.enum(HotspotIcon).default(HotspotIcon.PORTAL),
  }),
  z.object({
    type: z.literal(HotspotType.INFO),
    ...hotspotPosition,
    body: LocalizedTextSchema,
    icon: z.enum(HotspotIcon).default(HotspotIcon.INFO),
  }),
  z.object({
    type: z.literal(HotspotType.MEDIA),
    ...hotspotPosition,
    mediaAssetIds: z.array(idSchema).min(1),
    icon: z.enum(HotspotIcon).default(HotspotIcon.PHOTO),
  }),
  z.object({
    type: z.literal(HotspotType.URL),
    ...hotspotPosition,
    url: z.url(),
    icon: z.enum(HotspotIcon).default(HotspotIcon.INFO),
  }),
]);
export type HotspotCreate = z.infer<typeof HotspotCreateSchema>;

/** Paramètres de liste (F-01). Nombres déjà typés : `page` ≥ 1, `pageSize` 1…100, défaut 20. */
export const PaginationQuerySchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Page de résultats. `T` est le type d'un élément. */
export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

/** Schéma d'une page dont chaque élément suit `itemSchema`. */
export function paginated<Item extends z.ZodType>(itemSchema: Item) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
  });
}
