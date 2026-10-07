import { createHmac, timingSafeEqual } from 'node:crypto';

export const PREVIEW_TOKEN_TTL_SECONDS = 3600;

export function signPreviewToken(
  tourId: string,
  secret: string,
  nowMs: number
): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(nowMs / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
  const payload = `${tourId}.${expiresAt.toString()}`;
  const payloadB64 = Buffer.from(payload).toString('base64url');
  
  const hmac = createHmac('sha256', secret);
  hmac.update(payloadB64);
  const signatureB64 = hmac.digest('base64url');
  
  return {
    token: `${payloadB64}.${signatureB64}`,
    expiresAt,
  };
}

export function verifyPreviewToken(
  token: string,
  secret: string,
  nowMs: number
): { tourId: string } | null {
  if (!token || typeof token !== 'string') return null;
  
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [payloadB64, signatureB64] = parts as [string, string];
  
  // Re-compute signature
  const hmac = createHmac('sha256', secret);
  hmac.update(payloadB64);
  const expectedSignatureBuffer = Buffer.from(hmac.digest('base64url'));
  const actualSignatureBuffer = Buffer.from(signatureB64);
  
  if (expectedSignatureBuffer.length !== actualSignatureBuffer.length) {
    return null;
  }
  
  if (!timingSafeEqual(expectedSignatureBuffer, actualSignatureBuffer)) {
    return null;
  }
  
  const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
  const payloadParts = payload.split('.');
  
  if (payloadParts.length < 2) return null;
  
  const expStr = payloadParts.pop();
  const tourId = payloadParts.join('.');
  
  const expSeconds = parseInt(expStr as string, 10);
  if (isNaN(expSeconds)) return null;
  
  const nowSeconds = Math.floor(nowMs / 1000);
  if (expSeconds <= nowSeconds) {
    return null;
  }
  
  return { tourId };
}
