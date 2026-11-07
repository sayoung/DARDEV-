import { describe, expect, it } from 'vitest';

import {
  LoginTwoFactorBody,
  LoginTwoFactorBodySchema,
  TwoFactorCodeBody,
  TwoFactorCodeBodySchema,
  TwoFactorCodeSchema,
  TwoFactorSetupResponse,
  TwoFactorSetupResponseSchema,
  twoFactorCodeRegex,
} from './index.js';

// Vérification de compilation TypeScript : les alias valeur et type sont exportés et utilisables
describe('Alias de types TwoFactor', () => {
  it('permet d’annoter des objets avec les types exportés', () => {
    const setup: TwoFactorSetupResponse = {
      secret: 'test',
      otpauthUri: 'otpauth://...',
    };
    const codeBody: TwoFactorCodeBody = { code: '123456' };
    const loginBody: LoginTwoFactorBody = { code: '123456' };

    expect(setup.secret).toBe('test');
    expect(codeBody.code).toBe('123456');
    expect(loginBody.code).toBe('123456');
  });
});

describe('twoFactorCodeRegex', () => {
  it('correspond exactement à 6 chiffres décimaux', () => {
    expect(twoFactorCodeRegex.test('123456')).toBe(true);
    expect(twoFactorCodeRegex.test('000000')).toBe(true);
    expect(twoFactorCodeRegex.test('999999')).toBe(true);

    expect(twoFactorCodeRegex.test('12345')).toBe(false);
    expect(twoFactorCodeRegex.test('1234567')).toBe(false);
    expect(twoFactorCodeRegex.test('abcdef')).toBe(false);
    expect(twoFactorCodeRegex.test('12345a')).toBe(false);
    expect(twoFactorCodeRegex.test('a12345')).toBe(false);
    expect(twoFactorCodeRegex.test('12A456')).toBe(false);
    expect(twoFactorCodeRegex.test('')).toBe(false);
    expect(twoFactorCodeRegex.test(' 123456 ')).toBe(false);
    expect(twoFactorCodeRegex.test('12 345')).toBe(false);
    expect(twoFactorCodeRegex.test('   ')).toBe(false);
  });
});

describe('TwoFactorCodeSchema', () => {
  it('accepte un code à 6 chiffres', () => {
    expect(TwoFactorCodeSchema.parse('123456')).toBe('123456');
    expect(TwoFactorCodeSchema.parse('000000')).toBe('000000');
    expect(TwoFactorCodeSchema.parse('987654')).toBe('987654');
  });

  it('refuse un code de 5 chiffres', () => {
    expect(TwoFactorCodeSchema.safeParse('12345').success).toBe(false);
  });

  it('refuse un code de 7 chiffres', () => {
    expect(TwoFactorCodeSchema.safeParse('1234567').success).toBe(false);
  });

  it('refuse des lettres', () => {
    expect(TwoFactorCodeSchema.safeParse('abcdef').success).toBe(false);
  });

  it('refuse un mélange de chiffres et de lettres', () => {
    expect(TwoFactorCodeSchema.safeParse('12345a').success).toBe(false);
    expect(TwoFactorCodeSchema.safeParse('a12345').success).toBe(false);
    expect(TwoFactorCodeSchema.safeParse('12A456').success).toBe(false);
  });

  it('refuse une chaîne vide et des espaces', () => {
    expect(TwoFactorCodeSchema.safeParse('').success).toBe(false);
    expect(TwoFactorCodeSchema.safeParse(' 123456 ').success).toBe(false);
    expect(TwoFactorCodeSchema.safeParse('12 345').success).toBe(false);
    expect(TwoFactorCodeSchema.safeParse('   ').success).toBe(false);
  });
});

describe('TwoFactorSetupResponseSchema et TwoFactorSetupResponse', () => {
  it('valide une réponse d’initialisation 2FA complète', () => {
    const payload = {
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUri: 'otpauth://totp/Xplor:ada%40xplor.test?secret=JBSWY3DPEHPK3PXP&issuer=Xplor',
    };

    expect(TwoFactorSetupResponseSchema.parse(payload)).toEqual(payload);
    expect(TwoFactorSetupResponse.parse(payload)).toEqual(payload);
  });

  it('refuse un secret ou otpauthUri vide', () => {
    expect(
      TwoFactorSetupResponseSchema.safeParse({
        secret: '',
        otpauthUri: 'otpauth://totp/Xplor:ada%40xplor.test',
      }).success,
    ).toBe(false);

    expect(
      TwoFactorSetupResponse.safeParse({
        secret: '',
        otpauthUri: 'otpauth://totp/Xplor:ada%40xplor.test',
      }).success,
    ).toBe(false);

    expect(
      TwoFactorSetupResponseSchema.safeParse({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUri: '',
      }).success,
    ).toBe(false);

    expect(
      TwoFactorSetupResponse.safeParse({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUri: '',
      }).success,
    ).toBe(false);

    expect(
      TwoFactorSetupResponseSchema.safeParse({
        secret: '',
        otpauthUri: '',
      }).success,
    ).toBe(false);

    expect(
      TwoFactorSetupResponse.safeParse({
        secret: '',
        otpauthUri: '',
      }).success,
    ).toBe(false);
  });

  it('refuse des propriétés manquantes ou des types invalides', () => {
    expect(
      TwoFactorSetupResponseSchema.safeParse({
        otpauthUri: 'otpauth://totp/Xplor:ada%40xplor.test',
      }).success,
    ).toBe(false);

    expect(
      TwoFactorSetupResponseSchema.safeParse({
        secret: 'JBSWY3DPEHPK3PXP',
      }).success,
    ).toBe(false);

    expect(TwoFactorSetupResponseSchema.safeParse(null).success).toBe(false);
    expect(TwoFactorSetupResponseSchema.safeParse(undefined).success).toBe(false);
  });
});

describe('TwoFactorCodeBodySchema et TwoFactorCodeBody', () => {
  it('accepte un corps avec un code à 6 chiffres', () => {
    const payload = { code: '654321' };

    expect(TwoFactorCodeBodySchema.parse(payload)).toEqual(payload);
    expect(TwoFactorCodeBody.parse(payload)).toEqual(payload);
  });

  it('refuse un code invalide (5 chiffres, 7 chiffres, lettres, mélange, vide, espaces)', () => {
    const invalidCodes = [
      '12345',
      '1234567',
      'abcdef',
      '12345a',
      'a12345',
      '12A456',
      '',
      ' 123456 ',
      '12 345',
      '   ',
    ];

    for (const code of invalidCodes) {
      expect(TwoFactorCodeBodySchema.safeParse({ code }).success).toBe(false);
      expect(TwoFactorCodeBody.safeParse({ code }).success).toBe(false);
    }
  });

  it('refuse une propriété manquante ou un type non-string', () => {
    expect(TwoFactorCodeBodySchema.safeParse({}).success).toBe(false);
    expect(TwoFactorCodeBody.safeParse({}).success).toBe(false);
    expect(TwoFactorCodeBodySchema.safeParse({ code: 123456 }).success).toBe(false);
    expect(TwoFactorCodeBody.safeParse({ code: null }).success).toBe(false);
  });
});

describe('LoginTwoFactorBodySchema et LoginTwoFactorBody', () => {
  it('accepte un corps avec un code à 6 chiffres', () => {
    const payload = { code: '840192' };

    expect(LoginTwoFactorBodySchema.parse(payload)).toEqual(payload);
    expect(LoginTwoFactorBody.parse(payload)).toEqual(payload);
  });

  it('refuse un code invalide (5 chiffres, 7 chiffres, lettres, mélange, vide, espaces)', () => {
    const invalidCodes = [
      '12345',
      '1234567',
      'abcdef',
      '12345a',
      'a12345',
      '12A456',
      '',
      ' 123456 ',
      '12 345',
      '   ',
    ];

    for (const code of invalidCodes) {
      expect(LoginTwoFactorBodySchema.safeParse({ code }).success).toBe(false);
      expect(LoginTwoFactorBody.safeParse({ code }).success).toBe(false);
    }
  });

  it('refuse une propriété manquante ou un type non-string', () => {
    expect(LoginTwoFactorBodySchema.safeParse({}).success).toBe(false);
    expect(LoginTwoFactorBody.safeParse({}).success).toBe(false);
    expect(LoginTwoFactorBodySchema.safeParse({ code: 840192 }).success).toBe(false);
    expect(LoginTwoFactorBody.safeParse({ code: '' }).success).toBe(false);
  });
});
