import { describe, expect, it } from 'vitest';

import { PasswordSchema } from './password.js';

describe('PasswordSchema', () => {
  it('exige au moins 12 caractères', () => {
    expect(PasswordSchema.safeParse('a'.repeat(11)).success).toBe(false);
    expect(PasswordSchema.safeParse('a'.repeat(12)).success).toBe(true);
    expect(PasswordSchema.safeParse('mot-de-passe-long').success).toBe(true);
  });
});
