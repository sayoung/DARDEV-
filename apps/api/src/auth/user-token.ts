import { createHash, randomBytes } from 'node:crypto';

/** Invitation (F-90) : 48 heures. */
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

/** Réinitialisation de mot de passe : 1 heure (D-44, à valider). */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export type UserTokenKind = 'INVITE' | 'PASSWORD_RESET';

export type TokenCheckStatus = 'OK' | 'EXPIRED' | 'USED' | 'NOT_FOUND';

export type GeneratedToken = {
  /** 32 octets aléatoires, encodés en base64url. Jamais persisté. */
  token: string;
  /** Empreinte SHA-256 hexadécimale de `token`. */
  tokenHash: string;
};

/** Sous-ensemble lu par `checkToken`. `null` signifie que le jeton est inconnu. */
export type TokenCheckRecord = {
  expiresAt: Date;
  usedAt: Date | null;
};

/** 32 octets aléatoires et leur empreinte SHA-256. */
export function generateToken(): GeneratedToken {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/** SHA-256 du jeton, en hexadécimal (64 caractères). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Échéance absolue : 48 h pour une invitation, 1 h pour une réinitialisation. */
export function expiryFor(type: UserTokenKind, now: Date): Date {
  switch (type) {
    case 'INVITE':
      return new Date(now.getTime() + INVITE_TTL_MS);
    case 'PASSWORD_RESET':
      return new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
  }
}

/**
 * `USED` prime sur `EXPIRED` dès que `usedAt` est renseigné.
 * L'échéance est encore valide à l'instant `expiresAt` ; elle est dépassée 1 ms après.
 */
export function checkToken(record: TokenCheckRecord | null, now: Date): TokenCheckStatus {
  if (record === null) {
    return 'NOT_FOUND';
  }
  if (record.usedAt !== null) {
    return 'USED';
  }
  if (now.getTime() > record.expiresAt.getTime()) {
    return 'EXPIRED';
  }
  return 'OK';
}
