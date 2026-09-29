/** Identifiants refusés : email inconnu, mot de passe faux ou compte inactif. */
export const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS';

/** Compte encore dans la fenêtre de verrouillage (`lockout.ts`). */
export const ACCOUNT_LOCKED = 'ACCOUNT_LOCKED';

/** Jeton absent, expiré, déjà utilisé, ou d'un autre type. Même réponse dans tous les cas. */
export const TOKEN_INVALID = 'TOKEN_INVALID';

/** Mot de passe refusé par `PasswordSchema`. */
export const PASSWORD_INVALID = 'PASSWORD_INVALID';

/** Mot de passe présent dans la liste des mots courants. */
export const PASSWORD_TOO_COMMON = 'PASSWORD_TOO_COMMON';

export class AuthRejectedError extends Error {
  readonly statusCode: 401 | 423;
  readonly code: typeof INVALID_CREDENTIALS | typeof ACCOUNT_LOCKED;

  constructor(statusCode: 401 | 423, code: typeof INVALID_CREDENTIALS | typeof ACCOUNT_LOCKED) {
    super(code);
    this.name = 'AuthRejectedError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function invalidCredentials(): AuthRejectedError {
  return new AuthRejectedError(401, INVALID_CREDENTIALS);
}

export function accountLocked(): AuthRejectedError {
  return new AuthRejectedError(423, ACCOUNT_LOCKED);
}

export type AuthRequestCode =
  typeof TOKEN_INVALID | typeof PASSWORD_INVALID | typeof PASSWORD_TOO_COMMON;

/** Refus 400 d'une demande de réinitialisation. Le corps ne distingue pas les causes d'un jeton. */
export class AuthRequestError extends Error {
  readonly statusCode = 400 as const;
  readonly code: AuthRequestCode;

  constructor(code: AuthRequestCode) {
    super(code);
    this.name = 'AuthRequestError';
    this.code = code;
  }
}

export function tokenInvalid(): AuthRequestError {
  return new AuthRequestError(TOKEN_INVALID);
}
