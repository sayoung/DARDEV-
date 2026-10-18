/**
 * Types de contrat et utilitaires de vérification du code PIN de maintenance (F-67).
 *
 * Décision D-123 : l'API utilisant Argon2id pour `maintenancePinHash` (cahier des charges 5.6),
 * algorithme non pris en charge nativement par l'API Web Crypto du navigateur (`SubtleCrypto`),
 * l'option retenue côté architecture est la vérification par route API dédiée plutôt que par
 * hash en cache hors-ligne.
 *
 * Le module exporte :
 * - Le type fonctionnel du contrat de vérification (`MaintenancePinVerifier`).
 * - L'interface orientée objet du contrat de vérification (`MaintenancePinVerifierContract`).
 * - La fabrique `createApiPinVerifier` renvoyant un `MaintenancePinVerifier` connecté à l'API.
 * - La fonction utilitaire `verifyPinWithContract`.
 */

import { KioskPinVerifyRequestSchema } from '@xplor/shared';

import { verifyMaintenancePin } from './api/kiosk-api.js';

export interface ApiPinVerifierDeps {
  baseUrl: string;
  token: string;
  fetchFn?: typeof fetch;
}

/** Signature fonctionnelle du contrat de vérification du code PIN (en ligne ou en cache). */
export type MaintenancePinVerifier = (pin: string) => Promise<boolean>;

/** Interface orientée objet du contrat de vérification du code PIN. */
export interface MaintenancePinVerifierContract {
  verify(pin: string): Promise<boolean>;
}

/** Interface de contrat pour le cache local de code PIN hors-ligne (F-67). */
export interface MaintenancePinCache {
  remember(pin: string): Promise<void>;
  verify(pin: string): Promise<boolean>;
}

/** Dépendances pour la fabrique de vérificateur avec cache hors-ligne (F-67). */
export interface CachedPinVerifierDeps {
  online: (pin: string) => Promise<boolean>;
  cache: MaintenancePinCache;
}

/**
 * Exécute la vérification d'un PIN à travers un contrat MaintenancePinVerifier ou MaintenancePinVerifierContract.
 * Si le vérificateur est absent (null ou undefined) ou si la vérification échoue/rejette,
 * renvoie false sans propager d'exception (gestion résiliente de la vérification indisponible ou absente).
 */
export async function verifyPinWithContract(
  verifier: MaintenancePinVerifier | MaintenancePinVerifierContract | null | undefined,
  pin: string,
): Promise<boolean> {
  if (verifier === null || verifier === undefined) {
    return false;
  }

  const trimmedPin = pin.trim();
  if (trimmedPin.length === 0) {
    return false;
  }

  try {
    if (typeof verifier === 'function') {
      return await verifier(trimmedPin);
    }
    return await verifier.verify(trimmedPin);
  } catch {
    return false;
  }
}

/**
 * Fabrique d'un vérificateur de code PIN de maintenance connecté à l'API (F-67).
 * Renvoie une fonction respectant le contrat `MaintenancePinVerifier`.
 * - Si le format du PIN est invalide (non conforme au schéma), renvoie false sans appeler l'API.
 * - Si l'API répond { valid: true }, renvoie true.
 * - Si l'API répond { valid: false }, renvoie false (refus réel).
 * - En cas d'erreur réseau ou d'indisponibilité HTTP du serveur, propage l'erreur afin
 *   que le vérificateur en cache (`createCachedPinVerifier`) puisse basculer sur le cache local.
 */
export function createApiPinVerifier(deps: ApiPinVerifierDeps): MaintenancePinVerifier {
  return async (pin: string): Promise<boolean> => {
    const parseResult = KioskPinVerifyRequestSchema.safeParse({ pin });
    if (!parseResult.success) {
      return false;
    }
    return await verifyMaintenancePin(pin, {
      fetchFn: deps.fetchFn ?? fetch,
      baseUrl: deps.baseUrl,
      token: deps.token,
    });
  };
}

/**
 * Fabrique d'un vérificateur combinant vérification en ligne et cache hors-ligne (F-67).
 * - Appelle `online(pin)`.
 * - Si valid=true : appelle `cache.remember(pin)` et renvoie true.
 * - Si valid=false : renvoie false sans consulter le cache.
 * - Si `online(pin)` lève (panne réseau / serveur injoignable) : renvoie `cache.verify(pin)`.
 */
export function createCachedPinVerifier(deps: CachedPinVerifierDeps): MaintenancePinVerifier {
  return async (pin: string): Promise<boolean> => {
    let valid: boolean;
    try {
      valid = await deps.online(pin);
    } catch {
      return await deps.cache.verify(pin);
    }

    if (valid) {
      await deps.cache.remember(pin);
      return true;
    }

    return false;
  };
}
