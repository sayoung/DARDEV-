import { createHmac, timingSafeEqual } from 'node:crypto';

export const PREVIEW_TOKEN_TTL_SECONDS = 3600;

function toBase64Url(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64url');
}

function fromBase64Url(base64: string): string {
  return Buffer.from(base64, 'base64url').toString('utf-8');
}

export function signPreviewToken(tourId: string, secret: string, nowMs: number): { token: string; expiresAt: number } {
  const expiresAt = nowMs + PREVIEW_TOKEN_TTL_SECONDS * 1000;
  const expSeconds = Math.floor(expiresAt / 1000);
  const payloadStr = `${tourId}.${expSeconds.toString()}`;
  const payloadB64 = toBase64Url(payloadStr);

  const hmac = createHmac('sha256', secret);
  hmac.update(payloadB64);
  const signatureB64 = hmac.digest('base64url');

  return {
    token: `${payloadB64}.${signatureB64}`,
    expiresAt,
  };
}

export function verifyPreviewToken(token: string, secret: string, nowMs: number): { tourId: string } | null {
  if (!token || !token.includes('.')) {
    return null;
  }
  
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  
  const payloadB64 = parts[0];
  const signatureB64 = parts[1];
  
  if (typeof payloadB64 !== 'string' || typeof signatureB64 !== 'string') {
    return null;
  }

  // Re-calculate the expected signature
  const hmac = createHmac('sha256', secret);
  hmac.update(payloadB64);
  const expectedSignature = hmac.digest('base64url');

  const providedBuf = Buffer.from(signatureB64, 'base64url');
  const expectedBuf = Buffer.from(expectedSignature, 'base64url');

  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  const payloadStr = fromBase64Url(payloadB64);
  const payloadParts = payloadStr.split('.');
  if (payloadParts.length < 2) {
    return null;
  }

  // A tourId might contain dots, so we take the last part as expSeconds
  const expSecondsStr = payloadParts.pop();
  if (!expSecondsStr) return null;
  
  const tourId = payloadParts.join('.');
  const expSeconds = parseInt(expSecondsStr, 10);
  
  if (isNaN(expSeconds)) {
    return null;
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (expSeconds <= nowSeconds) {
    return null;
  }

  return { tourId };
}
