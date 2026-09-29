import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Ville ou catégorie encore référencée par une visite (API-25). */
export const IN_USE = 'IN_USE';

export const CITY_IN_USE_MESSAGE = 'Cette ville est utilisée par une visite.';

export const CATEGORY_IN_USE_MESSAGE = 'Cette catégorie est utilisée par une visite.';

/** Corps d'erreur du cahier : `{ error: { code, message } }`. */
export function inUseException(message: string): HttpException {
  return new HttpException({ error: { code: IN_USE, message } }, HttpStatus.CONFLICT);
}

/** Ville inconnue au moment de créer ou de modifier une visite (API-21). */
export const CITY_NOT_FOUND = 'CITY_NOT_FOUND';

export const CITY_NOT_FOUND_MESSAGE = 'Cette ville est inconnue.';

/** Catégorie inconnue au moment de créer ou de modifier une visite (API-21). */
export const CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND';

export const CATEGORY_NOT_FOUND_MESSAGE = 'Une catégorie est inconnue.';

/** Vignette inconnue au moment de créer ou de modifier une visite (API-21). */
export const COVER_ASSET_NOT_FOUND = 'COVER_ASSET_NOT_FOUND';

export const COVER_ASSET_NOT_FOUND_MESSAGE = 'Cette vignette est inconnue.';

/** Visite inconnue ou supprimée (API-22). */
export const TOUR_NOT_FOUND = 'TOUR_NOT_FOUND';

export const TOUR_NOT_FOUND_MESSAGE = 'Cette visite est inconnue.';

/** Scène inconnue ou supprimée, ou visite parente supprimée (API-22). */
export const SCENE_NOT_FOUND = 'SCENE_NOT_FOUND';

export const SCENE_NOT_FOUND_MESSAGE = 'Cette scène est inconnue.';

/** Panorama inconnu au moment de créer ou de modifier une scène (API-22). */
export const PANORAMA_ASSET_NOT_FOUND = 'PANORAMA_ASSET_NOT_FOUND';

export const PANORAMA_ASSET_NOT_FOUND_MESSAGE = 'Ce panorama est inconnu.';

/** La liste de réordonnancement n'est pas l'ensemble des scènes non supprimées (API-22). */
export const SCENE_SET_MISMATCH = 'SCENE_SET_MISMATCH';

export const SCENE_SET_MISMATCH_MESSAGE =
  'La liste ne contient pas exactement les scènes de la visite.';

/**
 * Scène de départ inconnue, supprimée ou rattachée à une autre visite (API-22).
 * Même code que `ValidationIssueCode.START_SCENE_FOREIGN`.
 */
export const START_SCENE_FOREIGN = 'START_SCENE_FOREIGN';

export const START_SCENE_FOREIGN_MESSAGE = "La scène de départ n'appartient pas à cette visite.";

/**
 * Cible d'un `SCENE_LINK` absente ou supprimée (API-23).
 * Même code que `ValidationIssueCode.SCENE_LINK_TARGET_MISSING`.
 * À la création, une scène supprimée utilise ce code (pas `SCENE_LINK_TARGET_DELETED`).
 */
export const SCENE_LINK_TARGET_MISSING = 'SCENE_LINK_TARGET_MISSING';

export const SCENE_LINK_TARGET_MISSING_MESSAGE = "Le lien de scène n'a pas de scène cible.";

/** `SCENE_LINK` vers la scène qui porte le hotspot (API-23). */
export const SCENE_LINK_SELF = 'SCENE_LINK_SELF';

export const SCENE_LINK_SELF_MESSAGE = 'Le lien de scène pointe vers sa propre scène.';

/** `SCENE_LINK` vers une scène d'une autre visite (API-23). */
export const SCENE_LINK_FOREIGN = 'SCENE_LINK_FOREIGN';

export const SCENE_LINK_FOREIGN_MESSAGE = "La scène cible n'appartient pas à cette visite.";

/** `TOUR_LINK` vers une visite absente ou supprimée (API-23). */
export const TOUR_LINK_TARGET_MISSING = 'TOUR_LINK_TARGET_MISSING';

export const TOUR_LINK_TARGET_MISSING_MESSAGE = "Le lien de visite n'a pas de visite cible.";

/** `TOUR_LINK` vers la visite de la scène porteuse (API-23). */
export const TOUR_LINK_SELF = 'TOUR_LINK_SELF';

export const TOUR_LINK_SELF_MESSAGE = 'Le lien de visite pointe vers la visite courante.';

/**
 * `targetTourSceneId` hors des scènes non supprimées de la visite cible (API-23).
 * Une visite cible en brouillon reste acceptée : le statut se contrôle à la publication.
 */
export const TOUR_LINK_SCENE_FOREIGN = 'TOUR_LINK_SCENE_FOREIGN';

export const TOUR_LINK_SCENE_FOREIGN_MESSAGE =
  "La scène d'arrivée n'appartient pas à la visite cible.";

/** Un identifiant de `mediaAssetIds` ne correspond à aucun média (API-23). */
export const MEDIA_ASSET_NOT_FOUND = 'MEDIA_ASSET_NOT_FOUND';

export const MEDIA_ASSET_NOT_FOUND_MESSAGE = 'Un média est inconnu.';

/** Référence inconnue ou incohérente : 422 `{ error: { code, message } }`. */
export function referenceException(code: string, message: string): HttpException {
  return new HttpException({ error: { code, message } }, HttpStatus.UNPROCESSABLE_ENTITY);
}

/** Visite ou scène absente : 404 `{ error: { code, message } }` (API-22, API-23). */
export function missingException(code: string, message: string): HttpException {
  return new HttpException({ error: { code, message } }, HttpStatus.NOT_FOUND);
}

/** `onDelete: Restrict` : Prisma répond P2003 si une clé étrangère tient encore. */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

/** La ligne a disparu entre la lecture et l'écriture. */
export function isRecordMissing(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
