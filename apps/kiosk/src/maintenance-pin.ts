/**
 * Types de contrat et utilitaires de vérification du code PIN de maintenance (F-67).
 *
 * Décision D-123 : l'API utilisant Argon2id pour `maintenancePinHash` (cahier des charges 5.6),
 * algorithme non pris en charge nativement par l'API Web Crypto du navigateur (`SubtleCrypto`),
 * l'option retenue côté architecture est la vérification par route API dédiée plutôt que par
 * déchiffrement/hachage local hors-ligne en cache.
 *
 * Le module exporte :
 * - Le contrat de vérification (`MaintenancePinVerifier`, `MaintenancePinVerifierContract`).
 * - Une fonction utilitaire `verifyPinWithContract` appliquant le garde « hash absent ».
 * - Une implémentation standard `verifyPinAgainstHash(pin, hash, crypto)` compatible Web Crypto
 *   (SHA-256) avec comparaison à temps constant.
 */

/** Interface minimale requise pour l'opération de hachage Web Crypto. */
export interface SubtleDigestCrypto {
  digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer>;
}

/** Signature fonctionnelle du contrat de vérification du code PIN. */
export type MaintenancePinVerifier = (
  pin: string,
  hash: string | null,
) => Promise<boolean>;

/** Interface orientée objet du contrat de vérification du code PIN. */
export interface MaintenancePinVerifierContract {
  verify(pin: string, hash: string | null): Promise<boolean>;
}

/** Signature de la fonction de vérification d'un PIN par rapport à une empreinte hachée. */
export type VerifyPinAgainstHashFn = (
  pin: string,
  hash: string | null | undefined,
  cryptoInstance?: SubtleDigestCrypto,
) => Promise<boolean>;

/**
 * Compare deux chaînes en temps constant pour limiter les attaques par canal auxiliaire (timing attacks).
 */
function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Vérifie un code PIN par rapport à un hash SHA-256 via Web Crypto (F-67).
 *
 * @param pin Le code PIN saisi par l'opérateur (ex. "1234").
 * @param hash L'empreinte stockée dans le manifeste (ex. SHA-256 hex ou format préfixé "sha256:...").
 * @param cryptoInstance Instance optionnelle de SubtleDigestCrypto pour injection dans les tests (défaut : globalThis.crypto?.subtle).
 * @returns true si le code PIN correspond à l'empreinte, false sinon (notamment si le hash est absent ou nul).
 */
export async function verifyPinAgainstHash(
  pin: string,
  hash: string | null | undefined,
  cryptoInstance?: SubtleDigestCrypto,
): Promise<boolean> {
  if (hash === null || hash === undefined) {
    return false;
  }

  const trimmedHash = hash.trim();
  if (trimmedHash.length === 0) {
    return false;
  }

  const trimmedPin = pin.trim();
  if (trimmedPin.length === 0) {
    return false;
  }

  const subtle =
    cryptoInstance !== undefined
      ? cryptoInstance
      : typeof globalThis.crypto !== 'undefined'
        ? globalThis.crypto.subtle
        : undefined;

  if (subtle === undefined) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(trimmedPin);
    const digestBuffer = await subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digestBuffer);

    let hexDigest = '';
    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      if (byte !== undefined) {
        hexDigest += byte.toString(16).padStart(2, '0');
      }
    }

    const normalizedTargetHash = trimmedHash.toLowerCase().replace(/^sha256:/, '');
    return constantTimeEqual(hexDigest, normalizedTargetHash);
  } catch {
    return false;
  }
}

/**
 * Exécute la vérification d'un PIN à travers un contrat MaintenancePinVerifier ou MaintenancePinVerifierContract.
 * Si le hash est absent (null, undefined ou chaîne vide), renvoie false immédiatement sans solliciter le vérificateur.
 */
export async function verifyPinWithContract(
  verifier: MaintenancePinVerifier | MaintenancePinVerifierContract,
  pin: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (hash === null || hash === undefined) {
    return false;
  }

  const trimmedHash = hash.trim();
  if (trimmedHash.length === 0) {
    return false;
  }

  const trimmedPin = pin.trim();
  if (trimmedPin.length === 0) {
    return false;
  }

  try {
    if (typeof verifier === 'function') {
      return await verifier(trimmedPin, trimmedHash);
    }
    return await verifier.verify(trimmedPin, trimmedHash);
  } catch {
    return false;
  }
}
