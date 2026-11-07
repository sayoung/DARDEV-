import * as crypto from 'node:crypto';

const IV_LENGTH_BYTES = 12; // 96-bit IV recommended for AES-GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag
const KEY_HEX_REGEX = /^[0-9a-fA-F]{64}$/;
const BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;

function parseEncryptionKey(keyHex: string): Buffer {
  if (typeof keyHex !== 'string' || keyHex.length !== 64 || !KEY_HEX_REGEX.test(keyHex)) {
    throw new Error('Invalid TOTP encryption key: must be a 64-character hex string (32 bytes)');
  }

  const keyBuffer = Buffer.from(keyHex, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Invalid TOTP encryption key: must be exactly 32 bytes');
  }

  return keyBuffer;
}

function isValidBase64(str: string): boolean {
  if (str.length === 0 || str.length % 4 !== 0) {
    return false;
  }
  return BASE64_REGEX.test(str);
}

/**
 * Encrypt a TOTP secret using AES-256-GCM.
 *
 * @param secret Plain text TOTP secret (e.g. Base32 encoded).
 * @param keyHex 64-character hexadecimal string representing a 32-byte key.
 * @returns Serialized encrypted payload formatted as `iv:tag:cipher` in base64.
 */
export function encryptTotpSecret(secret: string, keyHex: string): string {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('Invalid secret: must be a non-empty string');
  }

  const key = parseEncryptionKey(keyHex);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt a TOTP secret previously encrypted with encryptTotpSecret.
 *
 * @param payload Serialized encrypted payload formatted as `iv:tag:cipher` in base64.
 * @param keyHex 64-character hexadecimal string representing a 32-byte key.
 * @returns Plain text TOTP secret.
 */
export function decryptTotpSecret(payload: string, keyHex: string): string {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('Invalid encrypted payload: must be a non-empty string');
  }

  const key = parseEncryptionKey(keyHex);

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format: expected iv:tag:cipher');
  }

  const ivB64 = parts[0];
  const tagB64 = parts[1];
  const cipherB64 = parts[2];

  if (ivB64 === undefined || tagB64 === undefined || cipherB64 === undefined) {
    throw new Error('Invalid encrypted payload format: missing components');
  }

  if (!isValidBase64(ivB64) || !isValidBase64(tagB64) || !isValidBase64(cipherB64)) {
    throw new Error('Invalid encrypted payload: components must be valid base64');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const cipherText = Buffer.from(cipherB64, 'base64');

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error('Invalid encrypted payload: IV must be exactly 12 bytes');
  }

  if (tag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Invalid encrypted payload: auth tag must be exactly 16 bytes');
  }

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'decryption failed';
    throw new Error(`Failed to decrypt TOTP secret: ${message}`);
  }
}
