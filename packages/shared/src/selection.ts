import { z } from 'zod';

/**
 * Schéma d'un élément de sélection dans la réponse API (API-26, F-51).
 * Représente une visite rattachée à la sélection avec sa position ordonnée (≥ 0).
 */
export const SelectionItemResponseSchema = z.object({
  tourId: z.uuid(),
  position: z.number().int().min(0),
});

export type SelectionItemResponse = z.infer<typeof SelectionItemResponseSchema>;

/** Alias pratique pour le schéma d'un élément de sélection. */
export const SelectionItemSchema = SelectionItemResponseSchema;
export type SelectionItem = SelectionItemResponse;

/**
 * Schéma de mise à jour de la sélection d'un hôtel (API-26, F-51).
 * - tourIds : tableau ordonné d'UUID, 0 à 200 éléments, sans doublon
 * - featuredTourId : UUID nullable
 * - attractTourIds : tableau d'UUID sans doublon
 *
 * Deux validations transversales (refine) :
 * 1. featuredTourId, s'il n'est pas null, doit figurer dans tourIds
 * 2. chaque attractTourIds doit figurer dans tourIds
 */
export const SelectionUpdateSchema = z
  .object({
    tourIds: z
      .array(z.uuid())
      .min(0)
      .max(200)
      .refine((items) => new Set(items).size === items.length, {
        message: 'Les identifiants de visites ne doivent pas contenir de doublons',
      }),
    featuredTourId: z.uuid().nullable(),
    attractTourIds: z
      .array(z.uuid())
      .refine((items) => new Set(items).size === items.length, {
        message: 'Les identifiants de visites en mode veille ne doivent pas contenir de doublons',
      }),
  })
  .refine(
    (data) => data.featuredTourId === null || data.tourIds.includes(data.featuredTourId),
    {
      message: 'La visite mise en avant doit figurer dans la sélection',
      path: ['featuredTourId'],
    },
  )
  .refine(
    (data) => data.attractTourIds.every((id) => data.tourIds.includes(id)),
    {
      message: 'Chaque visite de veille doit figurer dans la sélection',
      path: ['attractTourIds'],
    },
  );

export type SelectionUpdate = z.infer<typeof SelectionUpdateSchema>;

/**
 * Schéma de réponse représentant la sélection d'un hôtel (API-26, F-51).
 * - hotelId : UUID de l'hôtel
 * - version : entier ≥ 1 incrémenté à chaque modification
 * - featuredTourId : UUID de la visite mise en avant ou null
 * - attractTourIds : tableau d'UUID des visites pour le mode veille
 * - items : liste ordonnée des visites avec leur position (≥ 0)
 * - updatedAt : date de dernière mise à jour (chaîne ISO 8601)
 */
export const SelectionResponseSchema = z.object({
  hotelId: z.uuid(),
  version: z.number().int().min(1),
  featuredTourId: z.uuid().nullable(),
  attractTourIds: z.array(z.uuid()),
  items: z.array(SelectionItemResponseSchema),
  updatedAt: z.iso.datetime(),
});

export type SelectionResponse = z.infer<typeof SelectionResponseSchema>;
