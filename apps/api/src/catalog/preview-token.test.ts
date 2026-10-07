import { describe, it, expect } from 'vitest';
import { signPreviewToken, verifyPreviewToken, PREVIEW_TOKEN_TTL_SECONDS } from './preview-token.js';

describe('Preview Token', () => {
  const secret = 'super-secret-key-12345';
  const tourId = 't-abc-123.xyz';

  it('aller-retour valide', () => {
    const nowMs = 1700000000000;
    const { token, expiresAt } = signPreviewToken(tourId, secret, nowMs);
    
    expect(token).toContain('.');
    expect(expiresAt).toBe(nowMs + PREVIEW_TOKEN_TTL_SECONDS * 1000);

    // Verify should succeed right away
    const result = verifyPreviewToken(token, secret, nowMs);
    expect(result).not.toBeNull();
    expect(result?.tourId).toBe(tourId);
    
    // Verify should succeed right before expiration
    const almostExpiredMs = nowMs + (PREVIEW_TOKEN_TTL_SECONDS * 1000) - 1000;
    const resultBeforeExp = verifyPreviewToken(token, secret, almostExpiredMs);
    expect(resultBeforeExp).not.toBeNull();
  });

  it('expiré à 3600 s pile', () => {
    const nowMs = 1700000000000;
    const { token } = signPreviewToken(tourId, secret, nowMs);
    
    // Expiration is at nowMs + 3600000
    const expiredMs = nowMs + (PREVIEW_TOKEN_TTL_SECONDS * 1000);
    const result = verifyPreviewToken(token, secret, expiredMs);
    
    expect(result).toBeNull();
  });

  it('secret différent → null', () => {
    const nowMs = 1700000000000;
    const { token } = signPreviewToken(tourId, secret, nowMs);
    
    const result = verifyPreviewToken(token, 'wrong-secret', nowMs);
    expect(result).toBeNull();
  });

  it('jeton altéré (tourId modifié) → null', () => {
    const nowMs = 1700000000000;
    const { token } = signPreviewToken(tourId, secret, nowMs);
    
    const parts = token.split('.');
    
    const payloadB64 = parts[0];
    const signatureB64 = parts[1];
    if (typeof payloadB64 !== 'string' || typeof signatureB64 !== 'string') {
      throw new Error('Invalid token parts');
    }
    
    // Decode payload
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    
    // Modify tourId
    const alteredPayloadStr = payloadStr.replace(tourId, 't-hacked');
    const alteredPayloadB64 = Buffer.from(alteredPayloadStr, 'utf-8').toString('base64url');
    
    const alteredToken = `${alteredPayloadB64}.${signatureB64}`;
    
    const result = verifyPreviewToken(alteredToken, secret, nowMs);
    expect(result).toBeNull();
  });

  it('chaîne vide ou sans point → null', () => {
    const nowMs = 1700000000000;
    
    expect(verifyPreviewToken('', secret, nowMs)).toBeNull();
    expect(verifyPreviewToken('just-a-string-without-dots', secret, nowMs)).toBeNull();
    expect(verifyPreviewToken('.', secret, nowMs)).toBeNull(); // Still invalid parts length or empty signature
  });
});
