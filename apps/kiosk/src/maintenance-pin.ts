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
 * - La fonction utilitaire `verifyPinWithContract`.
 */

/** Signature fonctionnelle du contrat de vérification du code PIN via route API (sans hash en cache). */
export type MaintenancePinVerifier = (pin: string) => Promise<boolean>;

/** Interface orientée objet du contrat de vérification du code PIN via route API (sans hash en cache). */
export interface MaintenancePinVerifierContract {
  verify(pin: string): Promise<boolean>;
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
