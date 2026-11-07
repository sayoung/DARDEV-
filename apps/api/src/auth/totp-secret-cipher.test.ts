import { describe, expect, it } from 'vitest';

import { decryptTotpSecret, encryptTotpSecret } from './totp-secret-cipher.js';
import { generateTotpSecret } from './totp.js';

const VALID_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ANOTHER_VALID_KEY_HEX = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('totp-secret-cipher', () => {
  describe('aller-retour (roundtrip)', () => {
    it('chiffre puis déchiffre avec succès un secret Base32 standard', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret, VALID_KEY_HEX);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(secret);

      const decrypted = decryptTotpSecret(encrypted, VALID_KEY_HEX);
      expect(decrypted).toBe(secret);
    });

    it('chiffre puis déchiffre avec succès un secret généré par generateTotpSecret', () => {
      const secret = generateTotpSecret();
      const encrypted = encryptTotpSecret(secret, VALID_KEY_HEX);

      const decrypted = decryptTotpSecret(encrypted, VALID_KEY_HEX);
      expect(decrypted).toBe(secret);
    });

    it('accepte une clé contenant des lettres hexadécimales majuscules', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const upperKey = VALID_KEY_HEX.toUpperCase();
      const encrypted = encryptTotpSecret(secret, upperKey);

      expect(decryptTotpSecret(encrypted, VALID_KEY_HEX)).toBe(secret);
      expect(decryptTotpSecret(encrypted, upperKey)).toBe(secret);
    });
  });

  describe('deux chiffrements du même secret différents', () => {
    it('génère un payload différent à chaque chiffrement grâce à un IV aléatoire', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted1 = encryptTotpSecret(secret, VALID_KEY_HEX);
      const encrypted2 = encryptTotpSecret(secret, VALID_KEY_HEX);

      expect(encrypted1).not.toBe(encrypted2);

      const parts1 = encrypted1.split(':');
      const parts2 = encrypted2.split(':');

      expect(parts1).toHaveLength(3);
      expect(parts2).toHaveLength(3);
      // Les IVs doivent être distincts
      expect(parts1[0]).not.toBe(parts2[0]);

      // Les deux déchiffrements restituent fidèlement le secret original
      expect(decryptTotpSecret(encrypted1, VALID_KEY_HEX)).toBe(secret);
      expect(decryptTotpSecret(encrypted2, VALID_KEY_HEX)).toBe(secret);
    });
  });

  describe('mauvaise clé refusée', () => {
    it('échoue au déchiffrement si la clé est différente', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret, VALID_KEY_HEX);

      expect(() => decryptTotpSecret(encrypted, ANOTHER_VALID_KEY_HEX)).toThrow(
        /Failed to decrypt TOTP secret/,
      );
    });

    it('refuse une clé trop courte (< 64 caractères hex / 32 octets) au chiffrement et au déchiffrement', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const shortKey = '0123456789abcdef';

      expect(() => encryptTotpSecret(secret, shortKey)).toThrow(/Invalid TOTP encryption key/);
      expect(() => decryptTotpSecret('iv:tag:cipher', shortKey)).toThrow(
        /Invalid TOTP encryption key/,
      );
    });

    it('refuse une clé trop longue (> 64 caractères hex) au chiffrement et au déchiffrement', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const longKey = `${VALID_KEY_HEX}ab`;

      expect(() => encryptTotpSecret(secret, longKey)).toThrow(/Invalid TOTP encryption key/);
      expect(() => decryptTotpSecret('iv:tag:cipher', longKey)).toThrow(
        /Invalid TOTP encryption key/,
      );
    });

    it('refuse une clé contenant des caractères non hexadécimaux', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const invalidKey = 'g'.repeat(64);

      expect(() => encryptTotpSecret(secret, invalidKey)).toThrow(/Invalid TOTP encryption key/);
      expect(() => decryptTotpSecret('iv:tag:cipher', invalidKey)).toThrow(
        /Invalid TOTP encryption key/,
      );
    });
  });

  describe('payload modifié refusé', () => {
    it('refuse un payload dont le texte chiffré a été altéré', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret, VALID_KEY_HEX);
      const parts = encrypted.split(':');

      const iv = parts[0];
      const tag = parts[1];
      const cipher = parts[2];

      expect(iv).toBeDefined();
      expect(tag).toBeDefined();
      expect(cipher).toBeDefined();

      if (iv !== undefined && tag !== undefined && cipher !== undefined) {
        // Altérer un octet du ciphertext tout en préservant le format base64
        const cipherBuf = Buffer.from(cipher, 'base64');
        const firstByte = cipherBuf[0];
        if (firstByte !== undefined) {
          cipherBuf[0] = firstByte ^ 1;
        }
        const tamperedCipher = cipherBuf.toString('base64');
        const tamperedPayload = `${iv}:${tag}:${tamperedCipher}`;

        expect(() => decryptTotpSecret(tamperedPayload, VALID_KEY_HEX)).toThrow(
          /Failed to decrypt TOTP secret/,
        );
      }
    });

    it("refuse un payload dont l'étiquette d'authentification (tag) a été altérée", () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret, VALID_KEY_HEX);
      const parts = encrypted.split(':');

      const iv = parts[0];
      const tag = parts[1];
      const cipher = parts[2];

      expect(iv).toBeDefined();
      expect(tag).toBeDefined();
      expect(cipher).toBeDefined();

      if (iv !== undefined && tag !== undefined && cipher !== undefined) {
        const tagBuf = Buffer.from(tag, 'base64');
        const firstByte = tagBuf[0];
        if (firstByte !== undefined) {
          tagBuf[0] = firstByte ^ 1;
        }
        const tamperedTag = tagBuf.toString('base64');
        const tamperedPayload = `${iv}:${tamperedTag}:${cipher}`;

        expect(() => decryptTotpSecret(tamperedPayload, VALID_KEY_HEX)).toThrow(
          /Failed to decrypt TOTP secret/,
        );
      }
    });

    it("refuse un payload dont le vecteur d'initialisation (IV) a été altéré", () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret, VALID_KEY_HEX);
      const parts = encrypted.split(':');

      const iv = parts[0];
      const tag = parts[1];
      const cipher = parts[2];

      expect(iv).toBeDefined();
      expect(tag).toBeDefined();
      expect(cipher).toBeDefined();

      if (iv !== undefined && tag !== undefined && cipher !== undefined) {
        const ivBuf = Buffer.from(iv, 'base64');
        const firstByte = ivBuf[0];
        if (firstByte !== undefined) {
          ivBuf[0] = firstByte ^ 1;
        }
        const tamperedIv = ivBuf.toString('base64');
        const tamperedPayload = `${tamperedIv}:${tag}:${cipher}`;

        expect(() => decryptTotpSecret(tamperedPayload, VALID_KEY_HEX)).toThrow(
          /Failed to decrypt TOTP secret/,
        );
      }
    });

    it('refuse un payload tronqué ou mal formaté', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret, VALID_KEY_HEX);

      // Chaîne vide
      expect(() => decryptTotpSecret('', VALID_KEY_HEX)).toThrow(/Invalid encrypted payload/);

      // Sans les 3 parties séparées par des deux-points
      expect(() => decryptTotpSecret('partie-unique', VALID_KEY_HEX)).toThrow(
        /Invalid encrypted payload format/,
      );
      expect(() => decryptTotpSecret('part1:part2', VALID_KEY_HEX)).toThrow(
        /Invalid encrypted payload format/,
      );
      expect(() => decryptTotpSecret('part1:part2:part3:extra', VALID_KEY_HEX)).toThrow(
        /Invalid encrypted payload format/,
      );

      // Tronqué au milieu
      const truncated = encrypted.slice(0, Math.floor(encrypted.length / 2));
      expect(() => decryptTotpSecret(truncated, VALID_KEY_HEX)).toThrow(
        /Invalid encrypted payload/,
      );
    });

    it('refuse un payload avec des caractères base64 invalides', () => {
      expect(() =>
        decryptTotpSecret('non*base64:autre*base64:encore*base64', VALID_KEY_HEX),
      ).toThrow(/components must be valid base64/);
    });
  });

  describe('validation des entrées', () => {
    it('refuse un secret vide au chiffrement', () => {
      expect(() => encryptTotpSecret('', VALID_KEY_HEX)).toThrow(/Invalid secret/);
    });
  });
});
