import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  INVITE_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  checkToken,
  expiryFor,
  generateToken,
  hashToken,
} from './user-token.js';

const NOW = new Date('2026-09-29T12:00:00.000Z');

describe('hashToken', () => {
  it('produit une empreinte SHA-256 stable', () => {
    const token = 'jeton-fixe';
    const expected = createHash('sha256').update(token).digest('hex');

    expect(hashToken(token)).toBe(expected);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toHaveLength(64);

    const generated = generateToken();
    expect(generated.tokenHash).toBe(hashToken(generated.token));
  });
});

describe('generateToken', () => {
  it('produit deux jetons différents de 32 octets', () => {
    const first = generateToken();
    const second = generateToken();

    expect(Buffer.from(first.token, 'base64url')).toHaveLength(32);
    expect(Buffer.from(second.token, 'base64url')).toHaveLength(32);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });
});

describe('expiryFor', () => {
  it('considère une invitation expirée à 48 h + 1 ms', () => {
    const expiresAt = expiryFor('INVITE', NOW);
    const record = { expiresAt, usedAt: null };

    expect(expiresAt.getTime() - NOW.getTime()).toBe(INVITE_TTL_MS);
    expect(checkToken(record, expiresAt)).toBe('OK');
    expect(checkToken(record, new Date(expiresAt.getTime() + 1))).toBe('EXPIRED');
  });

  it('fixe la réinitialisation à 1 h', () => {
    const expiresAt = expiryFor('PASSWORD_RESET', NOW);

    expect(expiresAt.getTime() - NOW.getTime()).toBe(PASSWORD_RESET_TTL_MS);
  });
});

describe('checkToken', () => {
  it('refuse un jeton déjà utilisé', () => {
    const record = {
      expiresAt: expiryFor('INVITE', NOW),
      usedAt: NOW,
    };

    expect(checkToken(record, NOW)).toBe('USED');
  });

  it('signale un jeton inconnu', () => {
    expect(checkToken(null, NOW)).toBe('NOT_FOUND');
  });
});
