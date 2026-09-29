/** Un compte existe déjà pour cette adresse. */
export const EMAIL_TAKEN = 'EMAIL_TAKEN';

export class EmailTakenError extends Error {
  readonly statusCode = 409 as const;
  readonly code = EMAIL_TAKEN;

  constructor() {
    super(EMAIL_TAKEN);
    this.name = 'EmailTakenError';
  }
}

export function emailTaken(): EmailTakenError {
  return new EmailTakenError();
}
