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

/** Référence de visite inconnue : 422 `{ error: { code, message } }`. */
export function referenceException(code: string, message: string): HttpException {
  return new HttpException({ error: { code, message } }, HttpStatus.UNPROCESSABLE_ENTITY);
}

/** Visite ou scène absente : 404 `{ error: { code, message } }` (API-22). */
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
