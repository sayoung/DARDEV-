import { z } from 'zod';

import { hotelLanguagesSchema } from './hotel.js';
import { KioskDeviceTypeSchema } from './kiosk.js';
import { LocalizedTextSchema } from './localized-text.js';

/** Visite présente dans le manifeste distribué à un kiosque (API-02). */
export const KioskManifestTourSchema = z.object({
  id: z.uuid(),
  contentVersion: z.number().int(),
  sizeBytes: z.number().int().min(0),
  url: z.string(),
  categoryId: z.uuid().nullable().optional(),
  categoryIds: z.array(z.uuid()).optional(),
});

/** Catégorie utilisée par le catalogue du kiosque (API-02). */
export const KioskManifestCategorySchema = z.object({
  id: z.uuid(),
  name: LocalizedTextSchema,
  icon: z.string(),
  color: z.string(),
});

/** Configuration complète synchronisée par un kiosque (API-02). */
export const KioskManifestSchema = z.object({
  manifestVersion: z.string(),
  kiosk: z.object({
    id: z.uuid(),
    label: z.string(),
    idleTimeoutSeconds: z.number().int(),
    deviceType: KioskDeviceTypeSchema,
  }),
  hotel: z.object({
    id: z.uuid(),
    name: z.string(),
    logoUrl: z.string().nullable(),
    brandColor: z.string(),
    languages: hotelLanguagesSchema,
    serviceActive: z.boolean(),
    maintenancePinHash: z.string().nullable(),
  }),
  selection: z.object({
    featuredTourId: z.uuid().nullable(),
    attractTourIds: z.array(z.uuid()),
    tours: z.array(KioskManifestTourSchema),
  }),
  categories: z.array(KioskManifestCategorySchema),
});

export type KioskManifest = z.infer<typeof KioskManifestSchema>;
export type KioskManifestTour = z.infer<typeof KioskManifestTourSchema>;
export type KioskManifestCategory = z.infer<typeof KioskManifestCategorySchema>;

/** Télémétrie envoyée périodiquement par un kiosque (API-03). */
export const KioskHeartbeatRequestSchema = z.object({
  appVersion: z.string().max(50),
  syncedManifestVersion: z.string().max(100).nullable(),
  storageFreeMb: z.number().int().min(0).nullable(),
  recentErrors: z.array(z.string().max(300)).max(10).default([]),
});

export type KioskHeartbeatRequest = z.infer<typeof KioskHeartbeatRequestSchema>;

/** Réponse de supervision à un heartbeat (API-03). */
export const KioskHeartbeatResponseSchema = z.object({
  forceSync: z.boolean(),
  serverTime: z.iso.datetime(),
});

export type KioskHeartbeatResponse = z.infer<typeof KioskHeartbeatResponseSchema>;

/** Demande de vérification du code PIN de maintenance d'un hôtel (F-67). */
export const KioskPinVerifyRequestSchema = z.object({
  pin: z.string().regex(/^\d{4,12}$/),
});

export type KioskPinVerifyRequest = z.infer<typeof KioskPinVerifyRequestSchema>;

/** Réponse de vérification du code PIN de maintenance (F-67). */
export const KioskPinVerifyResponseSchema = z.object({
  valid: z.boolean(),
});

export type KioskPinVerifyResponse = z.infer<typeof KioskPinVerifyResponseSchema>;
