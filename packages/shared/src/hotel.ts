import { z } from 'zod';

import { LANGS } from './lang.js';

/** Étoiles d'un hôtel client (cahier, 5.6). */
export enum HotelStars {
  FOUR = 'FOUR',
  FIVE = 'FIVE',
  LUXURY = 'LUXURY',
}

export const HotelStarsSchema = z.enum(HotelStars);

/** Type de contrat d'un hôtel client (cahier, 5.6). */
export enum ContractType {
  SALE = 'SALE',
  RENTAL = 'RENTAL',
}

export const ContractTypeSchema = z.enum(ContractType);

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

/**
 * Validation des langues proposées par un hôtel (cahier, 5.6).
 * Tableau non vide de codes parmi packages/shared/src/lang.ts, sans doublon.
 */
export const hotelLanguagesSchema = z
  .array(z.enum(LANGS))
  .min(1)
  .refine((items) => new Set(items).size === items.length, {
    message: 'Les langues ne doivent pas contenir de doublons',
  });

function isContractRangeValid(start: string, end: string): boolean {
  return new Date(end).getTime() >= new Date(start).getTime();
}

const hotelBaseShape = {
  name: z.string().trim().min(1).max(200),
  stars: HotelStarsSchema,
  cityId: z.uuid(),
  address: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.email(),
  logoAssetId: z.uuid().nullable().optional(),
  brandColor: hexColorSchema,
  contractType: ContractTypeSchema,
  contractStart: z.iso.datetime(),
  contractEnd: z.iso.datetime(),
  active: z.boolean().optional(),
};

const hotelShape = {
  ...hotelBaseShape,
  languages: hotelLanguagesSchema.default(['fr']),
};

/** Corps de création d'un hôtel (API-26, F-50). */
export const HotelCreateSchema = z
  .object(hotelShape)
  .refine((data) => isContractRangeValid(data.contractStart, data.contractEnd), {
    message: 'La date de fin de contrat doit être postérieure ou égale à la date de début',
    path: ['contractEnd'],
  });

export type HotelCreate = z.infer<typeof HotelCreateSchema>;

/** Corps de mise à jour d'un hôtel (API-26, F-50). */
export const HotelUpdateSchema = z
  .object({
    ...hotelBaseShape,
    languages: hotelLanguagesSchema.optional(),
  })
  .partial()
  .refine(
    (data) => {
      if (data.contractStart !== undefined && data.contractEnd !== undefined) {
        return isContractRangeValid(data.contractStart, data.contractEnd);
      }
      return true;
    },
    {
      message: 'La date de fin de contrat doit être postérieure ou égale à la date de début',
      path: ['contractEnd'],
    },
  );

export type HotelUpdate = z.infer<typeof HotelUpdateSchema>;

/**
 * Hôtel renvoyé par l'API admin (API-26).
 * Ne contient JAMAIS maintenancePinHash, mais expose hasMaintenancePin (booléen).
 * Les dates sont au format chaîne ISO 8601.
 */
export const HotelResponseSchema = z.object({
  id: z.uuid(),
  ...hotelShape,
  active: z.boolean(),
  hasMaintenancePin: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type HotelResponse = z.infer<typeof HotelResponseSchema>;

/** Liste d'hôtels renvoyée par l'API admin (API-26). */
export const HotelListResponseSchema = z.array(HotelResponseSchema);

export type HotelListResponse = z.infer<typeof HotelListResponseSchema>;

/** Gestionnaire rattaché à un hôtel (API-26, F-50). */
export const HotelManagerSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
});

export type HotelManager = z.infer<typeof HotelManagerSchema>;

/** Réponse de la liste des gestionnaires rattachés à un hôtel (API-26, F-50). */
export const HotelManagersResponseSchema = z.object({
  managers: z.array(HotelManagerSchema),
});

export type HotelManagersResponse = z.infer<typeof HotelManagersResponseSchema>;

/** Corps de mise à jour des gestionnaires rattachés à un hôtel (API-26, F-50). */
export const HotelManagersUpdateSchema = z.object({
  userIds: z
    .array(z.uuid())
    .min(0)
    .max(100)
    .refine((items) => new Set(items).size === items.length, {
      message: 'Les identifiants utilisateurs ne doivent pas contenir de doublons',
    }),
});

export type HotelManagersUpdate = z.infer<typeof HotelManagersUpdateSchema>;

