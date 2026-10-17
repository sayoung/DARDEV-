import { z } from 'zod';

/** Type d'appareil kiosque (F-52). */
export const KioskDeviceTypeSchema = z.enum([
  'TOUCH_SCREEN',
  'VR_HEADSET',
  'TOUCH_AND_HEADSET',
]);

export type KioskDeviceType = z.infer<typeof KioskDeviceTypeSchema>;

/** État administratif d'un kiosque (F-52). */
export const KioskStatusSchema = z.enum(['PENDING', 'ACTIVE', 'DISABLED']);

export type KioskStatus = z.infer<typeof KioskStatusSchema>;

/** État de connexion calculé pour la supervision (F-52). */
export const KioskConnectionStateSchema = z.enum([
  'ONLINE',
  'OFFLINE',
  'DESYNCHRONIZED',
  'PENDING',
  'DISABLED',
]);

export type KioskConnectionState = z.infer<typeof KioskConnectionStateSchema>;

const kioskMutableShape = {
  label: z.string().trim().min(1).max(200),
  deviceType: KioskDeviceTypeSchema,
  idleTimeoutSeconds: z.number().int().min(15).max(600),
};

/** Corps de création d'un kiosque (API-27, F-52). */
export const KioskCreateSchema = z.object({
  label: kioskMutableShape.label,
  hotelId: z.uuid(),
  deviceType: kioskMutableShape.deviceType,
  idleTimeoutSeconds: kioskMutableShape.idleTimeoutSeconds.optional(),
});

export type KioskCreate = z.infer<typeof KioskCreateSchema>;

/** Corps de mise à jour d'un kiosque (API-27, F-52). */
export const KioskUpdateSchema = z.object(kioskMutableShape).partial();

export type KioskUpdate = z.infer<typeof KioskUpdateSchema>;

/** Kiosque renvoyé par l'API, sans code d'enrôlement ni empreinte de jeton. */
export const KioskSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  hotelId: z.uuid(),
  deviceType: KioskDeviceTypeSchema,
  status: KioskStatusSchema,
  connectionState: KioskConnectionStateSchema,
  lastHeartbeatAt: z.iso.datetime().nullable(),
  appVersion: z.string().nullable(),
  syncedManifestVersion: z.string().nullable(),
  storageFreeMb: z.number().int().nullable(),
  idleTimeoutSeconds: z.number().int(),
  createdAt: z.iso.datetime(),
});

export type Kiosk = z.infer<typeof KioskSchema>;

/** Liste des kiosques (API-27, F-52). */
export const KioskListResponseSchema = z.object({
  items: z.array(KioskSchema),
});

export type KioskListResponse = z.infer<typeof KioskListResponseSchema>;

/** Code temporaire remis pour l'enrôlement d'un kiosque. */
export const EnrollmentCodeResponseSchema = z.object({
  code: z.string().length(8),
  expiresAt: z.iso.datetime(),
});

export type EnrollmentCodeResponse = z.infer<typeof EnrollmentCodeResponseSchema>;

/** Informations non personnelles transmises par le kiosque à l'enrôlement. */
export const KioskEnrollRequestSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{8}$/),
  deviceInfo: z.object({
    userAgent: z.string().max(500),
    screen: z.string().max(50).optional(),
  }),
});

export type KioskEnrollRequest = z.infer<typeof KioskEnrollRequestSchema>;

/** Jeton kiosque remis une seule fois après enrôlement. */
export const KioskEnrollResponseSchema = z.object({
  kioskId: z.uuid(),
  token: z.string(),
});

export type KioskEnrollResponse = z.infer<typeof KioskEnrollResponseSchema>;
