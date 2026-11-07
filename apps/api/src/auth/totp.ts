import * as crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a buffer or Uint8Array into a Base32 string (RFC 4648) without padding.
 */
export function base32Encode(buffer: Buffer | Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte === undefined) {
      continue;
    }
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      const charIndex = (value >>> (bits - 5)) & 31;
      const char = BASE32_ALPHABET[charIndex];
      if (char !== undefined) {
        output += char;
      }
      bits -= 5;
    }
  }

  if (bits > 0) {
    const charIndex = (value << (5 - bits)) & 31;
    const char = BASE32_ALPHABET[charIndex];
    if (char !== undefined) {
      output += char;
    }
  }

  return output;
}

/**
 * Decode an RFC 4648 Base32 string (with or without padding) into a Buffer.
 */
export function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === undefined) {
      continue;
    }
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate 20 random cryptographically secure bytes encoded in Base32.
 */
export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

function parseSecret(secret: string): Buffer {
  try {
    return base32Decode(secret);
  } catch {
    return Buffer.from(secret, 'utf-8');
  }
}

function totpCodeAtStep(key: Buffer, stepCounter: number, digits: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.max(0, stepCounter)));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const lastByte = hmac[hmac.length - 1];
  if (lastByte === undefined) {
    throw new Error('Unexpected HMAC digest length');
  }

  const offset = lastByte & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  const modulus = Math.pow(10, digits);
  const otp = binary % modulus;

  return otp.toString().padStart(digits, '0');
}

/**
 * Generate a TOTP code (RFC 6238) using HMAC-SHA1 and dynamic truncation.
 */
export function totpCode(
  secret: string,
  timeMs: number,
  step = 30,
  digits = 6,
): string {
  const key = parseSecret(secret);
  const stepCounter = Math.floor(timeMs / 1000 / step);
  return totpCodeAtStep(key, stepCounter, digits);
}

/**
 * Verify a 6-digit TOTP code against a secret within a time window (default +/-1 step).
 * Rejects any code not composed of exactly 6 digits using constant-time comparison.
 */
export function verifyTotp(
  secret: string,
  code: string,
  timeMs: number,
  window = 1,
): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    return false;
  }
  if (!Number.isInteger(window) || window < 0) {
    return false;
  }

  let key: Buffer;
  try {
    key = parseSecret(secret);
  } catch {
    return false;
  }
  if (key.length === 0) {
    return false;
  }

  const step = 30;
  const currentStep = Math.floor(timeMs / 1000 / step);
  const codeBuffer = Buffer.from(code, 'utf-8');
  let matched = false;

  for (let offset = -window; offset <= window; offset++) {
    const stepCounter = currentStep + offset;
    if (stepCounter < 0) {
      continue;
    }
    const expected = totpCodeAtStep(key, stepCounter, 6);
    const expectedBuffer = Buffer.from(expected, 'utf-8');

    if (
      codeBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(codeBuffer, expectedBuffer)
    ) {
      matched = true;
    }
  }

  return matched;
}

/**
 * Build a standard otpauth:// URI for authenticator applications.
 */
export function otpauthUri(
  secret: string,
  accountEmail: string,
  issuer = 'Xplor',
): string {
  const cleanSecret = secret.replace(/[\s=-]/g, '').toUpperCase();
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}`;
  const params = new URLSearchParams({
    secret: cleanSecret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}
