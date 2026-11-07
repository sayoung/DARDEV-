import * as crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totpCode,
  verifyTotp,
} from './totp.js';

describe('TOTP (RFC 6238) & Base32 (RFC 4648)', () => {
  describe('base32Encode / base32Decode', () => {
    it('encodes and decodes an empty buffer', () => {
      const empty = Buffer.alloc(0);
      const encoded = base32Encode(empty);
      expect(encoded).toBe('');
      const decoded = base32Decode(encoded);
      expect(decoded.length).toBe(0);
    });

    it('roundtrips arbitrary buffers of various lengths', () => {
      const lengths = [1, 2, 3, 4, 5, 8, 10, 16, 20, 32, 64];
      for (const len of lengths) {
        const randomBytes = crypto.randomBytes(len);
        const encoded = base32Encode(randomBytes);
        // Base32 RFC 4648 without padding should only contain A-Z and 2-7
        expect(/^[A-Z2-7]*$/.test(encoded)).toBe(true);
        const decoded = base32Decode(encoded);
        expect(decoded.equals(randomBytes)).toBe(true);
      }
    });

    it('roundtrips UTF-8 and ASCII text', () => {
      const samples = [
        'Hello World!',
        '12345678901234567890',
        'Plateforme Xplor VR SMIT 2026',
      ];
      for (const sample of samples) {
        const buf = Buffer.from(sample, 'utf-8');
        const encoded = base32Encode(buf);
        const decoded = base32Decode(encoded);
        expect(decoded.toString('utf-8')).toBe(sample);
      }
    });

    it('handles lowercase, spaces, hyphens and padding in base32Decode', () => {
      const buf = Buffer.from('test-secret', 'utf-8');
      const standard = base32Encode(buf);
      const withPadding = standard + '====';
      const withSpaces = `  ${standard.slice(0, 4)} - ${standard.slice(4)}  `;
      const lowercase = standard.toLowerCase();

      expect(base32Decode(standard).equals(buf)).toBe(true);
      expect(base32Decode(withPadding).equals(buf)).toBe(true);
      expect(base32Decode(withSpaces).equals(buf)).toBe(true);
      expect(base32Decode(lowercase).equals(buf)).toBe(true);
    });

    it('throws on invalid base32 characters', () => {
      expect(() => base32Decode('INVALID8')).toThrow('Invalid base32 character: 8');
      expect(() => base32Decode('INVALID9')).toThrow('Invalid base32 character: 9');
      expect(() => base32Decode('INVALID0')).toThrow('Invalid base32 character: 0');
      expect(() => base32Decode('INVALID1')).toThrow('Invalid base32 character: 1');
      expect(() => base32Decode('INVALID@')).toThrow('Invalid base32 character: @');
    });
  });

  describe('generateTotpSecret', () => {
    it('generates a 32-character base32 secret representing 20 random bytes', () => {
      const secret = generateTotpSecret();
      expect(secret.length).toBe(32);
      expect(/^[A-Z2-7]{32}$/.test(secret)).toBe(true);
      const decoded = base32Decode(secret);
      expect(decoded.length).toBe(20);
    });

    it('produces distinct secrets on subsequent calls', () => {
      const s1 = generateTotpSecret();
      const s2 = generateTotpSecret();
      expect(s1).not.toBe(s2);
    });
  });

  describe('RFC 6238 Appendix B test vectors (HMAC-SHA1)', () => {
    // Shared secret ASCII "12345678901234567890" (20 bytes)
    const asciiSecret = '12345678901234567890';
    const base32Secret = base32Encode(Buffer.from(asciiSecret, 'ascii'));

    it('matches RFC 6238 Annex B vector at T = 59 s -> 94287082 (8 digits)', () => {
      const timeMs = 59 * 1000;
      // Tested with raw ASCII secret
      expect(totpCode(asciiSecret, timeMs, 30, 8)).toBe('94287082');
      // Tested with base32 encoded secret
      expect(totpCode(base32Secret, timeMs, 30, 8)).toBe('94287082');
    });

    it('matches RFC 6238 Annex B vector at T = 1111111109 s -> 07081804 (8 digits)', () => {
      const timeMs = 1111111109 * 1000;
      expect(totpCode(asciiSecret, timeMs, 30, 8)).toBe('07081804');
      expect(totpCode(base32Secret, timeMs, 30, 8)).toBe('07081804');
    });

    it('matches additional RFC 6238 Annex B vectors in 8 digits', () => {
      expect(totpCode(asciiSecret, 1111111111 * 1000, 30, 8)).toBe('14050471');
      expect(totpCode(asciiSecret, 1234567890 * 1000, 30, 8)).toBe('89005924');
      expect(totpCode(asciiSecret, 2000000000 * 1000, 30, 8)).toBe('69279037');
    });

    it('uses step = 30 and digits = 6 by default', () => {
      const code = totpCode(base32Secret, 59 * 1000);
      expect(code.length).toBe(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
      // The 6-digit equivalent of 94287082 is the last 6 digits: 287082
      expect(code).toBe('287082');
    });
  });

  describe('verifyTotp (window +/-1 accepted, +/-2 rejected, timingSafeEqual)', () => {
    const secret = generateTotpSecret();
    const stepDurationMs = 30 * 1000;
    const now = 1700000000000;

    const codeCurrent = totpCode(secret, now);
    const codeMinus1 = totpCode(secret, now - stepDurationMs);
    const codePlus1 = totpCode(secret, now + stepDurationMs);
    const codeMinus2 = totpCode(secret, now - 2 * stepDurationMs);
    const codePlus2 = totpCode(secret, now + 2 * stepDurationMs);

    it('accepts current code and window +/- 1 with default window = 1', () => {
      expect(verifyTotp(secret, codeCurrent, now)).toBe(true);
      expect(verifyTotp(secret, codeMinus1, now)).toBe(true);
      expect(verifyTotp(secret, codePlus1, now)).toBe(true);
    });

    it('rejects window +/- 2 with default window = 1', () => {
      expect(verifyTotp(secret, codeMinus2, now)).toBe(false);
      expect(verifyTotp(secret, codePlus2, now)).toBe(false);
    });

    it('accepts window +/- 2 when window is explicitly set to 2', () => {
      expect(verifyTotp(secret, codeMinus2, now, 2)).toBe(true);
      expect(verifyTotp(secret, codePlus2, now, 2)).toBe(true);
    });

    it('rejects wrong 6-digit codes', () => {
      const wrongCode = codeCurrent === '123456' ? '654321' : '123456';
      expect(verifyTotp(secret, wrongCode, now)).toBe(false);
    });

    it('rejects malformed codes not composed of exactly 6 digits', () => {
      const malformedCases = [
        '',
        '12345', // 5 digits
        '1234567', // 7 digits
        'abcdef', // letters
        '12345a', // alphanumeric
        ' 12345', // space
        '12 345', // internal space
        '12345\n', // newline
        '12-345', // hyphen
        '-12345', // negative
        ' 123456 ', // padded spaces
      ];

      for (const malformed of malformedCases) {
        expect(verifyTotp(secret, malformed, now)).toBe(false);
      }
    });

    it('rejects invalid or empty secrets gracefully without throwing', () => {
      expect(verifyTotp('', codeCurrent, now)).toBe(false);
      expect(verifyTotp('INVALID@SECRET', codeCurrent, now)).toBe(false);
    });

    it('rejects invalid timeMs or invalid window values', () => {
      expect(verifyTotp(secret, codeCurrent, -1)).toBe(false);
      expect(verifyTotp(secret, codeCurrent, NaN)).toBe(false);
      expect(verifyTotp(secret, codeCurrent, now, -1)).toBe(false);
    });
  });

  describe('otpauthUri', () => {
    it('generates a compliant otpauth:// URI with default issuer Xplor', () => {
      const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
      const uri = otpauthUri(secret, 'admin@xplor.local');

      expect(uri.startsWith('otpauth://totp/Xplor:admin%40xplor.local?')).toBe(true);
      expect(uri).toContain('secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
      expect(uri).toContain('issuer=Xplor');
      expect(uri).toContain('algorithm=SHA1');
      expect(uri).toContain('digits=6');
      expect(uri).toContain('period=30');
    });

    it('supports custom issuer and sanitizes secret formatting', () => {
      const rawSecret = 'gez d-gnbv-gy3t-qojq=';
      const uri = otpauthUri(rawSecret, 'manager@hotel.ma', 'Hotel Xplor');

      expect(uri.startsWith('otpauth://totp/Hotel%20Xplor:manager%40hotel.ma?')).toBe(true);
      expect(uri).toContain('secret=GEZDGEZDGNBVGY3TQOJQ'.slice(0, 5));
      expect(uri).toContain('issuer=Hotel+Xplor');
      expect(uri).toContain('digits=6');
      expect(uri).toContain('period=30');
    });
  });
});
