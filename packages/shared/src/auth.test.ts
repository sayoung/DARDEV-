import { describe, expect, it } from 'vitest';

import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  MeResponseSchema,
  ResetPasswordRequestSchema,
} from './auth.js';
import { Role } from './role.js';

const me = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada',
  role: Role.EDITOR,
  uiLang: 'ar' as const,
  csrfToken: 'csrf-token',
};

describe('LoginRequestSchema', () => {
  it('accepte un email et un mot de passe', () => {
    expect(LoginRequestSchema.parse({ email: 'ada@xplor.test', password: 'secret' })).toEqual({
      email: 'ada@xplor.test',
      password: 'secret',
    });
  });

  it('refuse un email invalide', () => {
    expect(LoginRequestSchema.safeParse({ email: 'ada', password: 'secret' }).success).toBe(false);
  });
});

describe('MeResponseSchema', () => {
  it('décrit le profil et le jeton CSRF', () => {
    expect(MeResponseSchema.parse(me)).toEqual(me);
  });

  it('refuse un rôle ou une langue inconnus', () => {
    expect(MeResponseSchema.safeParse({ ...me, role: 'GUEST' }).success).toBe(false);
    expect(MeResponseSchema.safeParse({ ...me, uiLang: 'es' }).success).toBe(false);
  });
});

describe('ForgotPasswordRequestSchema', () => {
  it('accepte un email', () => {
    expect(ForgotPasswordRequestSchema.parse({ email: 'ada@xplor.test' })).toEqual({
      email: 'ada@xplor.test',
    });
  });

  it('refuse un email invalide', () => {
    expect(ForgotPasswordRequestSchema.safeParse({ email: 'ada' }).success).toBe(false);
    expect(ForgotPasswordRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('ResetPasswordRequestSchema', () => {
  it('accepte un jeton non vide et un mot de passe d’au moins 12 caractères', () => {
    const body = { token: 'jeton-opaque', password: 'a'.repeat(12) };

    expect(ResetPasswordRequestSchema.parse(body)).toEqual(body);
  });

  it('refuse un jeton vide ou un mot de passe trop court', () => {
    expect(
      ResetPasswordRequestSchema.safeParse({ token: '', password: 'a'.repeat(12) }).success,
    ).toBe(false);
    expect(
      ResetPasswordRequestSchema.safeParse({ token: 'jeton', password: 'a'.repeat(11) }).success,
    ).toBe(false);
  });
});
