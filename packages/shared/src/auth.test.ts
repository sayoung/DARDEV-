import { describe, expect, it } from 'vitest';

import {
  AcceptInviteRequestSchema,
  ForgotPasswordRequestSchema,
  InviteUserRequestSchema,
  InviteUserResponseSchema,
  Login2faRequestSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  MeResponseSchema,
  ResetPasswordRequestSchema,
  TwoFactorRequiredResponseSchema,
} from './auth.js';
import { Role } from './role.js';

const me = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada',
  role: Role.EDITOR,
  uiLang: 'ar' as const,
  csrfToken: 'csrf-token',
  totpEnabled: false,
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
  it('décrit le profil, le jeton CSRF et totpEnabled', () => {
    expect(MeResponseSchema.parse(me)).toEqual(me);
  });

  it('accepte et conserve un profil avec totpEnabled: true', () => {
    const profile = { ...me, totpEnabled: true };
    expect(MeResponseSchema.parse(profile)).toEqual(profile);
    expect(MeResponseSchema.parse(profile).totpEnabled).toBe(true);
  });

  it('refuse un profil sans totpEnabled', () => {
    const withoutTotp: Record<string, unknown> = { ...me };
    delete withoutTotp.totpEnabled;
    expect(MeResponseSchema.safeParse(withoutTotp).success).toBe(false);
  });

  it('ne laisse passer aucun champ totpSecret', () => {
    const parsed = MeResponseSchema.parse({
      ...me,
      totpEnabled: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
    });
    expect('totpSecret' in parsed).toBe(false);
    expect(Object.keys(parsed)).not.toContain('totpSecret');
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

const inviteBody = {
  email: 'ada@xplor.test',
  name: 'Ada',
  role: Role.EDITOR,
  uiLang: 'ar' as const,
};

describe('InviteUserRequestSchema', () => {
  it('accepte un email, un nom, un rôle et une langue', () => {
    expect(InviteUserRequestSchema.parse({ ...inviteBody, name: '  Ada  ' })).toEqual(inviteBody);
  });

  it('refuse un nom vide, un email, un rôle ou une langue invalides', () => {
    expect(InviteUserRequestSchema.safeParse({ ...inviteBody, name: '   ' }).success).toBe(false);
    expect(InviteUserRequestSchema.safeParse({ ...inviteBody, name: '' }).success).toBe(false);
    expect(InviteUserRequestSchema.safeParse({ ...inviteBody, email: 'ada' }).success).toBe(false);
    expect(InviteUserRequestSchema.safeParse({ ...inviteBody, role: 'GUEST' }).success).toBe(false);
    expect(InviteUserRequestSchema.safeParse({ ...inviteBody, uiLang: 'es' }).success).toBe(false);
  });
});

describe('InviteUserResponseSchema', () => {
  it('décrit le compte invité', () => {
    const body = {
      id: 'user-1',
      email: 'ada@xplor.test',
      name: 'Ada',
      role: Role.HOTEL_MANAGER,
    };

    expect(InviteUserResponseSchema.parse(body)).toEqual(body);
  });

  it('refuse un nom vide ou un rôle inconnu', () => {
    expect(
      InviteUserResponseSchema.safeParse({
        id: 'user-1',
        email: 'ada@xplor.test',
        name: '',
        role: Role.ADMIN,
      }).success,
    ).toBe(false);
    expect(
      InviteUserResponseSchema.safeParse({
        id: 'user-1',
        email: 'ada@xplor.test',
        name: 'Ada',
        role: 'GUEST',
      }).success,
    ).toBe(false);
  });
});

describe('AcceptInviteRequestSchema', () => {
  it('accepte un jeton non vide et un mot de passe d’au moins 12 caractères', () => {
    const body = { token: 'jeton-opaque', password: 'a'.repeat(12) };

    expect(AcceptInviteRequestSchema.parse(body)).toEqual(body);
  });

  it('refuse un jeton vide ou un mot de passe trop court', () => {
    expect(
      AcceptInviteRequestSchema.safeParse({ token: '', password: 'a'.repeat(12) }).success,
    ).toBe(false);
    expect(
      AcceptInviteRequestSchema.safeParse({ token: 'jeton', password: 'a'.repeat(11) }).success,
    ).toBe(false);
  });
});

describe('TwoFactorRequiredResponseSchema', () => {
  it('accepte twoFactorRequired: true', () => {
    expect(TwoFactorRequiredResponseSchema.parse({ twoFactorRequired: true })).toEqual({
      twoFactorRequired: true,
    });
  });

  it('refuse twoFactorRequired: false ou toute autre valeur', () => {
    expect(TwoFactorRequiredResponseSchema.safeParse({ twoFactorRequired: false }).success).toBe(
      false,
    );
    expect(TwoFactorRequiredResponseSchema.safeParse({ twoFactorRequired: 'true' }).success).toBe(
      false,
    );
    expect(TwoFactorRequiredResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe('LoginResponseSchema', () => {
  it('accepte un MeResponse complet', () => {
    expect(LoginResponseSchema.parse(me)).toEqual(me);
  });

  it('accepte une demande de 2FA', () => {
    expect(LoginResponseSchema.parse({ twoFactorRequired: true })).toEqual({
      twoFactorRequired: true,
    });
  });

  it('refuse une réponse non conforme aux deux variantes', () => {
    expect(LoginResponseSchema.safeParse({ twoFactorRequired: false }).success).toBe(false);
    expect(LoginResponseSchema.safeParse({}).success).toBe(false);
    expect(LoginResponseSchema.safeParse({ ...me, role: 'INCONNU' }).success).toBe(false);
  });
});

describe('Login2faRequestSchema', () => {
  it('accepte un code TOTP de 6 à 12 caractères et retire les espaces superflus', () => {
    expect(Login2faRequestSchema.parse({ code: '123456' })).toEqual({ code: '123456' });
    expect(Login2faRequestSchema.parse({ code: '  654321  ' })).toEqual({ code: '654321' });
    expect(Login2faRequestSchema.parse({ code: '123456789012' })).toEqual({ code: '123456789012' });
  });

  it('refuse un code de moins de 6 caractères ou de plus de 12 caractères', () => {
    expect(Login2faRequestSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(Login2faRequestSchema.safeParse({ code: '   123   ' }).success).toBe(false);
    expect(Login2faRequestSchema.safeParse({ code: '1234567890123' }).success).toBe(false);
  });

  it('refuse un code vide ou non fourni', () => {
    expect(Login2faRequestSchema.safeParse({ code: '' }).success).toBe(false);
    expect(Login2faRequestSchema.safeParse({ code: '      ' }).success).toBe(false);
    expect(Login2faRequestSchema.safeParse({}).success).toBe(false);
  });
});
