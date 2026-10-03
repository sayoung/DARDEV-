import * as crypto from 'crypto';

export function signStorageToken(key: string, expiresAt: number, sizeBytes: number, secret: string): string {
  const payload = `${key}:${expiresAt.toString(10)}:${sizeBytes.toString(10)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

export function verifyStorageToken(
  token: string,
  secret: string
): { key: string; expiresAt: number; sizeBytes: number } {
  const decoded = Buffer.from(token, 'base64url').toString('utf-8');
  const lastColon = decoded.lastIndexOf(':');
  if (lastColon === -1) {
    throw new Error('Invalid token format');
  }

  const payload = decoded.substring(0, lastColon);
  const signature = decoded.substring(lastColon + 1);

  const parts = payload.split(':');
  if (parts.length < 3) {
    throw new Error('Invalid token format');
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new Error('Invalid signature');
  }

  const sizeBytesStr = parts.pop();
  const expiresAtStr = parts.pop();
  
  if (!sizeBytesStr || !expiresAtStr) {
    throw new Error('Invalid token format');
  }

  const key = parts.join(':'); // key could theoretically contain colons

  const expiresAt = parseInt(expiresAtStr, 10);
  const sizeBytes = parseInt(sizeBytesStr, 10);

  if (isNaN(expiresAt) || isNaN(sizeBytes)) {
    throw new Error('Invalid token format');
  }

  if (Date.now() > expiresAt) {
    throw new Error('Token expired');
  }

  return { key, expiresAt, sizeBytes };
}
