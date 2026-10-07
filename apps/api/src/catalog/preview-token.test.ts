import { describe, it, expect } from 'vitest';
import {
  signPreviewToken,
  verifyPreviewToken,
  PREVIEW_TOKEN_TTL_SECONDS,
} from './preview-token.js';

describe('preview-token', () => {
  const secret = 'super-secret-key';
  const tourId = 'tour_12345';
  const nowMs = 1700000000000;

  it('validates a correct roundtrip', () => {
    const { token, expiresAt } = signPreviewToken(tourId, secret, nowMs);
    expect(expiresAt).toBe(Math.floor(nowMs / 1000) + PREVIEW_TOKEN_TTL_SECONDS);
    
    const result = verifyPreviewToken(token, secret, nowMs);
    expect(result).not.toBeNull();
    expect(result?.tourId).toBe(tourId);
  });

  it('returns null if token exactly expired', () => {
    const { token } = signPreviewToken(tourId, secret, nowMs);
    const expiredNowMs = nowMs + PREVIEW_TOKEN_TTL_SECONDS * 1000;
    
    const result = verifyPreviewToken(token, secret, expiredNowMs);
    expect(result).toBeNull();
  });

  it('returns null if secret is different', () => {
    const { token } = signPreviewToken(tourId, secret, nowMs);
    
    const result = verifyPreviewToken(token, 'wrong-secret', nowMs);
    expect(result).toBeNull();
  });

  it('returns null if token is altered (tourId modified)', () => {
    const { token } = signPreviewToken(tourId, secret, nowMs);
    
    const parts = token.split('.');
    const fakeExp = Math.floor(nowMs / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
    const fakePayloadStr = `hacked_tour.${fakeExp.toString()}`;
    const fakePayloadB64 = Buffer.from(fakePayloadStr).toString('base64url');
    
    const alteredToken = `${fakePayloadB64}.${parts[1] as string}`;
    
    const result = verifyPreviewToken(alteredToken, secret, nowMs);
    expect(result).toBeNull();
  });

  it('returns null for empty string or no dot', () => {
    expect(verifyPreviewToken('', secret, nowMs)).toBeNull();
    expect(verifyPreviewToken('nodotsinhere', secret, nowMs)).toBeNull();
    expect(verifyPreviewToken('one.dot.too.many', secret, nowMs)).toBeNull();
  });
});
