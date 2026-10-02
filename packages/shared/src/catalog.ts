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
export const idSchema = z.uuidv7();
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

export const CityListResponseSchema = z.array(CityResponseSchema);
export type CityListResponse = z.infer<typeof CityListResponseSchema>;

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

export const CategoryListResponseSchema = z.array(CategoryResponseSchema);
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;

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

/**
 * Visite renvoyée par l'API admin (API-21).
 * La scène de départ se lit en base ; la réponse scène ne la répète pas.
 */
export const TourResponseSchema = z.object({
  id: idSchema,
  ...tourShape,
  status: z.enum(TourStatus),
  publicShare: z.boolean(),
  /** 22 caractères, émis par le service (`crypto.randomBytes`). */
  shareToken: z.string().length(22),
  /** Scènes dont `deletedAt` est vide. */
  sceneCount: z.number().int().min(0),
  createdById: idSchema,
  contentVersion: z.number().int().min(1),
  startSceneId: idSchema.nullable(),
  publishedAt: z.iso.datetime().nullable(),
});
export type TourResponse = z.infer<typeof TourResponseSchema>;

const sceneShape = {
  title: LocalizedTextSchema,
  caption: LocalizedTextSchema.optional(),
  panoramaAssetId: idSchema,
  initialYaw: yawSchema.default(0),
  initialPitch: pitchSchema.default(0),
  initialZoom: z.number().int().min(0).max(100).default(50),
  weight: z.number().int(),
  narration: z.record(z.string(), idSchema).optional(),
  ambientAssetId: idSchema.optional().nullable(),
};

/** Corps de création d'une scène (API-22). */
export const SceneCreateSchema = z.object(sceneShape);
export type SceneCreate = z.infer<typeof SceneCreateSchema>;

/** Remplacement d'une scène : mêmes champs que la création. */
export const SceneUpdateSchema = z.object(sceneShape);
export type SceneUpdate = z.infer<typeof SceneUpdateSchema>;

/**
 * Scène renvoyée par l'API admin (API-22).
 * `hotspotCount` compte les hotspots (suppression physique, cahier 5.4).
 * `createdAt` et `updatedAt` sont des dates ISO 8601.
 * Narration, son d'ambiance et plan restent hors de ce schéma.
 */
export const SceneResponseSchema = z.object({
  id: idSchema,
  tourId: idSchema,
  title: LocalizedTextSchema,
  caption: LocalizedTextSchema.optional(),
  panoramaAssetId: idSchema,
  initialYaw: yawSchema,
  initialPitch: pitchSchema,
  initialZoom: z.number().int().min(0).max(100),
  weight: z.number().int(),
  hotspotCount: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  narration: z.record(z.string(), idSchema).optional().nullable(),
  ambientAssetId: idSchema.optional().nullable(),
});
export type SceneResponse = z.infer<typeof SceneResponseSchema>;

export const SceneListResponseSchema = z.array(SceneResponseSchema);
export type SceneListResponse = z.infer<typeof SceneListResponseSchema>;

/**
 * Corps de `POST .../scenes/reorder` (API-22).
 * Le service exige l'ensemble exact des scènes non supprimées, sans doublon.
 */
export const SceneReorderRequestSchema = z.object({
  sceneIds: z.array(idSchema),
});
export type SceneReorderRequest = z.infer<typeof SceneReorderRequestSchema>;

/** Corps de `POST .../scenes/set-start` (API-22). */
export const SetStartSceneRequestSchema = z.object({
  sceneId: idSchema,
});
export type SetStartSceneRequest = z.infer<typeof SetStartSceneRequestSchema>;

const hotspotPosition = {
  yaw: yawSchema,
  pitch: pitchSchema,
  label: LocalizedTextSchema,
  arrivalYaw: yawSchema.optional(),
};

/**
 * Variantes d'un hotspot (cahier, 5.4). Création et remplacement partagent
 * cette union : le corps porte `type`, donc un remplacement peut en changer.
 * Icône par défaut : ARROW, PORTAL, INFO, PHOTO, INFO selon le type (D-67).
 * `z.url()` accepte `javascript:` et `data:` (XSS stocké dans le viewer).
 */
const hotspotVariants = [
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
    url: z.httpUrl(),
    icon: z.enum(HotspotIcon).default(HotspotIcon.INFO),
  }),
] as const;

/**
 * Corps de création d'un hotspot (API-23).
 * `sceneId` vient de la route. L'union impose les champs du type.
 * L'appartenance au graphe de la visite est vérifiée plus tard (F-03).
 */
export const HotspotCreateSchema = z.discriminatedUnion('type', hotspotVariants);
export type HotspotCreate = z.infer<typeof HotspotCreateSchema>;

/**
 * Remplacement d'un hotspot (API-23, D-73).
 * Mêmes variantes que la création : tous les champs requis du type choisi.
 * Le `type` fait partie du corps, il peut donc changer.
 */
export const HotspotUpdateSchema = z.discriminatedUnion('type', hotspotVariants);
export type HotspotUpdate = z.infer<typeof HotspotUpdateSchema>;

/**
 * Hotspot renvoyé par l'API admin (API-23, D-73).
 * Les champs propres à une variante sont nullables : la réponse est plate.
 * `mediaAssetIds` est un tableau de chaînes, vide hors d'un hotspot `MEDIA`.
 * `url`, lorsqu'elle est présente, reste `http` ou `https`.
 * `createdAt` et `updatedAt` sont des dates ISO 8601.
 */
export const HotspotResponseSchema = z.object({
  id: idSchema,
  sceneId: idSchema,
  type: z.enum(HotspotType),
  yaw: yawSchema,
  pitch: pitchSchema,
  label: LocalizedTextSchema,
  targetSceneId: idSchema.nullable(),
  targetTourId: idSchema.nullable(),
  targetTourSceneId: idSchema.nullable(),
  body: LocalizedTextSchema.nullable(),
  url: z.httpUrl().nullable(),
  arrivalYaw: yawSchema.nullable(),
  mediaAssetIds: z.array(z.string()),
  icon: z.enum(HotspotIcon),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type HotspotResponse = z.infer<typeof HotspotResponseSchema>;

/**
 * Média renvoyé en lecture seule (F-05).
 * `width`, `height` et `copyright` valent `null` tant qu'ils ne sont pas connus.
 * `createdAt` est une date ISO 8601. L'upload reste en M2 (API-24).
 */
export const AssetResponseSchema = z.object({
  id: idSchema,
  kind: z.enum(AssetKind),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  width: z.number().int().min(0).nullable(),
  height: z.number().int().min(0).nullable(),
  processingStatus: z.enum(ProcessingStatus),
  processingLog: z.string().nullable(),
  copyright: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AssetResponse = z.infer<typeof AssetResponseSchema>;

/** Paramètres de liste (F-01). Nombres déjà typés : `page` ≥ 1, `pageSize` 1…100, défaut 20. */
export const PaginationQuerySchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Liste admin des visites (API-21). `page` absent vaut 1.
 * Les chaînes de query sont converties en nombres avant ce schéma (D-67).
 */
export const TourListQuerySchema = PaginationQuerySchema.extend({
  page: z.number().int().min(1).default(1),
  status: z.enum(TourStatus).optional(),
  cityId: idSchema.optional(),
  categoryId: idSchema.optional(),
  /** Recherche sur le titre français. Une chaîne vide ne filtre pas. */
  q: z.string().optional(),
});
export type TourListQuery = z.infer<typeof TourListQuerySchema>;

/**
 * Liste admin des médias (F-05). `page` absent vaut 1.
 * `kind` filtre sur la nature du fichier. Les chaînes de query sont converties avant ce schéma.
 */
export const AssetListQuerySchema = PaginationQuerySchema.extend({
  page: z.number().int().min(1).default(1),
  kind: z.enum(AssetKind).optional(),
});
export type AssetListQuery = z.infer<typeof AssetListQuerySchema>;

/** Schéma d'une page dont chaque élément suit `itemSchema`. */
export function paginated<Item extends z.ZodType>(itemSchema: Item) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
  });
}

/** Page de résultats. Déduit du schéma pour rester aligné sur `paginated`. */
export type Paginated<T> = z.infer<ReturnType<typeof paginated<z.ZodType<T>>>>;

/** Page de visites (API-21). */
export const PaginatedTourResponseSchema = paginated(TourResponseSchema);
export type PaginatedTourResponse = Paginated<TourResponse>;

/** Page de médias (F-05). */
export const PaginatedAssetResponseSchema = paginated(AssetResponseSchema);
export type PaginatedAssetResponse = Paginated<AssetResponse>;

/**
 * Code d'un refus de publication (cahier 5.4, F-03).
 * L'admin importe cet enum ; il ne le redéclare pas.
 */
export enum ValidationIssueCode {
  START_SCENE_MISSING = 'START_SCENE_MISSING',
  START_SCENE_FOREIGN = 'START_SCENE_FOREIGN',
  PANORAMA_NOT_READY = 'PANORAMA_NOT_READY',
  SCENE_UNREACHABLE = 'SCENE_UNREACHABLE',
  SCENE_LINK_TARGET_MISSING = 'SCENE_LINK_TARGET_MISSING',
  SCENE_LINK_SELF = 'SCENE_LINK_SELF',
  SCENE_LINK_FOREIGN = 'SCENE_LINK_FOREIGN',
  SCENE_LINK_TARGET_DELETED = 'SCENE_LINK_TARGET_DELETED',
  TOUR_LINK_TARGET_MISSING = 'TOUR_LINK_TARGET_MISSING',
  TOUR_LINK_SELF = 'TOUR_LINK_SELF',
  TOUR_LINK_TARGET_UNPUBLISHED = 'TOUR_LINK_TARGET_UNPUBLISHED',
  TOUR_LINK_SCENE_FOREIGN = 'TOUR_LINK_SCENE_FOREIGN',
}

/**
 * Un problème de publication. `message` est en français, prêt à afficher.
 * `sceneId` et `hotspotId` sont des UUID facultatifs.
 */
export const ValidationIssueSchema = z.object({
  code: z.enum(ValidationIssueCode),
  sceneId: z.uuid().optional(),
  hotspotId: z.uuid().optional(),
  message: z.string(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * Réponse de `POST /admin/tours/:id/validate` (F-03).
 * `issues` vide : la visite est publiable. La route ne publie pas.
 */
export const TourValidationResponseSchema = z.object({
  issues: z.array(ValidationIssueSchema),
});
export type TourValidationResponse = z.infer<typeof TourValidationResponseSchema>;

/**
 * Corps de création d'un upload de média (API-24).
 */
export const AssetUploadRequestSchema = z.object({
  kind: z.enum(AssetKind),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  filename: z.string().min(1).max(200),
});
export type AssetUploadRequest = z.infer<typeof AssetUploadRequestSchema>;

/**
 * Réponse d'initialisation d'un upload (API-24).
 */
export const AssetUploadResponseSchema = z.object({
  assetId: idSchema,
  uploadUrl: z.httpUrl(),
  uploadMethod: z.literal('PUT'),
  expiresInSeconds: z.number().int().positive(),
});
export type AssetUploadResponse = z.infer<typeof AssetUploadResponseSchema>;
