import { describe, expect, it } from 'vitest';

import { LoginRequestSchema, MeResponseSchema } from './auth.js';
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
