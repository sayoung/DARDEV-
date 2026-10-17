import { createHash, randomBytes, randomInt } from 'node:crypto';

const ENROLLMENT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEVICE_TOKEN_BYTES = 32;

export const ENROLLMENT_CODE_TTL_MINUTES = 60;

/** Génère un code d'enrôlement de 8 caractères sans symboles ambigus. */
export function generateEnrollmentCode(): string {
  return Array.from({ length: 8 }, () =>
    ENROLLMENT_CODE_ALPHABET[randomInt(ENROLLMENT_CODE_ALPHABET.length)],
  ).join('');
}

/** Génère un jeton d'appareil aléatoire de 256 bits en base64url. */
export function generateDeviceToken(): string {
  return randomBytes(DEVICE_TOKEN_BYTES).toString('base64url');
}

/** Empreinte SHA-256 hexadécimale d'un jeton d'appareil. */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Calcule l'expiration d'un code d'enrôlement à partir de `now`. */
export function computeEnrollmentExpiry(now: Date): Date {
  return new Date(now.getTime() + ENROLLMENT_CODE_TTL_MINUTES * 60 * 1000);
}
