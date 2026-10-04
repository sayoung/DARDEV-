import { randomBytes } from 'node:crypto';

/** 16 octets en base64url, sans padding : 22 caractères (colonne `VarChar(22)`). */
export const SHARE_TOKEN_BYTES = 16;

export function createShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}
