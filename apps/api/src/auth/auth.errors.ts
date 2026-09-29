/** Identifiants refusés : email inconnu, mot de passe faux ou compte inactif. */
export const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS';

/** Compte encore dans la fenêtre de verrouillage (`lockout.ts`). */
export const ACCOUNT_LOCKED = 'ACCOUNT_LOCKED';

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
