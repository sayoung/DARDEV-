import { describe, expect, it } from 'vitest';

import {
  computeEnrollmentExpiry,
  ENROLLMENT_CODE_TTL_MINUTES,
  generateDeviceToken,
  generateEnrollmentCode,
  hashDeviceToken,
} from './kiosk-secrets.js';

const ENROLLMENT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const NOW = new Date('2026-10-17T12:00:00.000Z');

describe('generateEnrollmentCode', () => {
  it('produit des codes de 8 caractères dans l’alphabet autorisé', () => {
    for (let index = 0; index < 200; index += 1) {
      const code = generateEnrollmentCode();

      expect(code).toHaveLength(8);
      expect(new RegExp(`^[${ENROLLMENT_CODE_ALPHABET}]{8}$`).test(code)).toBe(true);
    }
  });
});

describe('device tokens', () => {
  it('produit des jetons base64url de 32 octets distincts', () => {
    const first = generateDeviceToken();
    const second = generateDeviceToken();

    expect(first).toHaveLength(43);
    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
    expect(second).toHaveLength(43);
    expect(Buffer.from(second, 'base64url')).toHaveLength(32);
    expect(first).not.toBe(second);
  });

  it('calcule une empreinte SHA-256 déterministe distincte du jeton', () => {
    const token = generateDeviceToken();
    const hash = hashDeviceToken(token);

    expect(hashDeviceToken(token)).toBe(hash);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
  });
});

describe('computeEnrollmentExpiry', () => {
  it('ajoute 60 minutes à la date fournie', () => {
    const expiry = computeEnrollmentExpiry(NOW);

    expect(ENROLLMENT_CODE_TTL_MINUTES).toBe(60);
    expect(expiry.getTime() - NOW.getTime()).toBe(60 * 60 * 1000);
    expect(expiry).not.toBe(NOW);
  });
});
