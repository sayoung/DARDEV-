import { describe, expect, it } from 'vitest';

import {
  ContractType,
  ContractTypeSchema,
  HotelCreateSchema,
  HotelListResponseSchema,
  HotelResponseSchema,
  HotelStars,
  HotelStarsSchema,
  HotelUpdateSchema,
} from './hotel.js';

const validCityId = '01990000-0000-7000-8000-000000000001';
const validLogoAssetId = '01990000-0000-7000-8000-000000000002';
const validHotelId = '01990000-0000-7000-8000-000000000101';
const contractStart = '2026-01-01T00:00:00.000Z';
const contractEnd = '2027-01-01T00:00:00.000Z';
const createdAt = '2026-01-01T12:00:00.000Z';
const updatedAt = '2026-01-02T12:00:00.000Z';

const validHotelInput = {
  name: 'Hôtel Démonstration Rabat',
  stars: HotelStars.FIVE,
  cityId: validCityId,
  address: '1 avenue de la Démonstration, Rabat',
  phone: '+212537000000',
  email: 'rabat.demo@xplor.local',
  logoAssetId: validLogoAssetId,
  brandColor: '#1F6F8B',
  languages: ['fr', 'ar', 'en'],
  contractType: ContractType.RENTAL,
  contractStart,
  contractEnd,
  active: true,
};

const validHotelResponse = {
  id: validHotelId,
  name: 'Hôtel Démonstration Rabat',
  stars: HotelStars.FIVE,
  cityId: validCityId,
  address: '1 avenue de la Démonstration, Rabat',
  phone: '+212537000000',
  email: 'rabat.demo@xplor.local',
  logoAssetId: validLogoAssetId,
  brandColor: '#1F6F8B',
  languages: ['fr', 'ar', 'en'],
  contractType: ContractType.RENTAL,
  contractStart,
  contractEnd,
  active: true,
  hasMaintenancePin: true,
  createdAt,
  updatedAt,
};

describe('HotelStarsSchema', () => {
  it('accepte les trois catégories d’étoiles', () => {
    expect(HotelStarsSchema.parse(HotelStars.FOUR)).toBe(HotelStars.FOUR);
    expect(HotelStarsSchema.parse(HotelStars.FIVE)).toBe(HotelStars.FIVE);
    expect(HotelStarsSchema.parse(HotelStars.LUXURY)).toBe(HotelStars.LUXURY);
    expect(HotelStarsSchema.parse('FOUR')).toBe('FOUR');
    expect(HotelStarsSchema.parse('FIVE')).toBe('FIVE');
    expect(HotelStarsSchema.parse('LUXURY')).toBe('LUXURY');
  });

  it('refuse une catégorie d’étoiles invalide', () => {
    expect(HotelStarsSchema.safeParse('THREE').success).toBe(false);
    expect(HotelStarsSchema.safeParse('TWO').success).toBe(false);
    expect(HotelStarsSchema.safeParse('').success).toBe(false);
    expect(HotelStarsSchema.safeParse(null).success).toBe(false);
  });
});

describe('ContractTypeSchema', () => {
  it('accepte les types de contrat vente et location', () => {
    expect(ContractTypeSchema.parse(ContractType.SALE)).toBe(ContractType.SALE);
    expect(ContractTypeSchema.parse(ContractType.RENTAL)).toBe(ContractType.RENTAL);
    expect(ContractTypeSchema.parse('SALE')).toBe('SALE');
    expect(ContractTypeSchema.parse('RENTAL')).toBe('RENTAL');
  });

  it('refuse un type de contrat invalide', () => {
    expect(ContractTypeSchema.safeParse('LEASE').success).toBe(false);
    expect(ContractTypeSchema.safeParse('FREE').success).toBe(false);
    expect(ContractTypeSchema.safeParse('').success).toBe(false);
  });
});

describe('HotelCreateSchema', () => {
  it('accepte un corps de création complet et valide (cas valide)', () => {
    const parsed = HotelCreateSchema.parse(validHotelInput);
    expect(parsed).toEqual(validHotelInput);
  });

  it('applique la langue française par défaut si languages est omis', () => {
    const withoutLanguages = {
      name: validHotelInput.name,
      stars: validHotelInput.stars,
      cityId: validHotelInput.cityId,
      address: validHotelInput.address,
      phone: validHotelInput.phone,
      email: validHotelInput.email,
      logoAssetId: validHotelInput.logoAssetId,
      brandColor: validHotelInput.brandColor,
      contractType: validHotelInput.contractType,
      contractStart: validHotelInput.contractStart,
      contractEnd: validHotelInput.contractEnd,
      active: validHotelInput.active,
    };
    const parsed = HotelCreateSchema.parse(withoutLanguages);
    expect(parsed.languages).toEqual(['fr']);
  });

  it('accepte active omis et logoAssetId null ou omis', () => {
    const minimal = {
      name: validHotelInput.name,
      stars: validHotelInput.stars,
      cityId: validHotelInput.cityId,
      address: validHotelInput.address,
      phone: validHotelInput.phone,
      email: validHotelInput.email,
      brandColor: validHotelInput.brandColor,
      languages: validHotelInput.languages,
      contractType: validHotelInput.contractType,
      contractStart: validHotelInput.contractStart,
      contractEnd: validHotelInput.contractEnd,
    };
    const withNullLogo = { ...minimal, logoAssetId: null };
    expect(HotelCreateSchema.parse(minimal).logoAssetId).toBeUndefined();
    expect(HotelCreateSchema.parse(withNullLogo).logoAssetId).toBeNull();
    expect(HotelCreateSchema.parse(minimal).active).toBeUndefined();
  });

  it('nettoie les espaces autour du nom (trim)', () => {
    const withSpaces = { ...validHotelInput, name: '   Hôtel des Oudayas   ' };
    const parsed = HotelCreateSchema.parse(withSpaces);
    expect(parsed.name).toBe('Hôtel des Oudayas');
  });

  it('accepte contractEnd égal à contractStart', () => {
    const sameDate = { ...validHotelInput, contractEnd: contractStart };
    expect(HotelCreateSchema.safeParse(sameDate).success).toBe(true);
  });

  it('refuse une couleur de marque invalide (couleur invalide)', () => {
    expect(HotelCreateSchema.safeParse({ ...validHotelInput, brandColor: 'blue' }).success).toBe(
      false,
    );
    expect(HotelCreateSchema.safeParse({ ...validHotelInput, brandColor: '#fff' }).success).toBe(
      false,
    );
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, brandColor: '#1234567' }).success,
    ).toBe(false);
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, brandColor: '#GGGGGG' }).success,
    ).toBe(false);
    expect(HotelCreateSchema.safeParse({ ...validHotelInput, brandColor: '1F6F8B' }).success).toBe(
      false,
    );
  });

  it('refuse une date de fin antérieure à la date de début (dates inversées)', () => {
    const inverted = {
      ...validHotelInput,
      contractStart: '2027-01-01T00:00:00.000Z',
      contractEnd: '2026-01-01T00:00:00.000Z',
    };
    const result = HotelCreateSchema.safeParse(inverted);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['contractEnd']);
    }
  });

  it('refuse une langue inconnue (langue inconnue)', () => {
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, languages: ['es'] }).success,
    ).toBe(false);
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, languages: ['fr', 'de'] }).success,
    ).toBe(false);
  });

  it('refuse des doublons de langue ou une liste de langues vide', () => {
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, languages: ['fr', 'fr'] }).success,
    ).toBe(false);
    expect(HotelCreateSchema.safeParse({ ...validHotelInput, languages: [] }).success).toBe(
      false,
    );
  });

  it('refuse un nom vide, un nom d’espaces seuls ou un nom excédant 200 caractères', () => {
    expect(HotelCreateSchema.safeParse({ ...validHotelInput, name: '' }).success).toBe(false);
    expect(HotelCreateSchema.safeParse({ ...validHotelInput, name: '    ' }).success).toBe(false);
    const tooLongName = 'a'.repeat(201);
    expect(HotelCreateSchema.safeParse({ ...validHotelInput, name: tooLongName }).success).toBe(
      false,
    );
  });

  it('refuse un email invalide ou un cityId non UUID', () => {
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, email: 'pas-un-email' }).success,
    ).toBe(false);
    expect(HotelCreateSchema.safeParse({ ...validHotelInput, cityId: 'pas-un-uuid' }).success).toBe(
      false,
    );
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, logoAssetId: 'pas-un-uuid' }).success,
    ).toBe(false);
  });

  it('refuse des dates de contrat non ISO', () => {
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, contractStart: '2026/01/01' }).success,
    ).toBe(false);
    expect(
      HotelCreateSchema.safeParse({ ...validHotelInput, contractEnd: 'demain' }).success,
    ).toBe(false);
  });
});

describe('HotelUpdateSchema', () => {
  it('accepte un corps de mise à jour partiel ou vide (cas valide)', () => {
    expect(HotelUpdateSchema.parse({})).toEqual({});
    expect(HotelUpdateSchema.parse({ name: 'Hôtel Rénové' })).toEqual({ name: 'Hôtel Rénové' });
    expect(HotelUpdateSchema.parse({ active: false })).toEqual({ active: false });
    expect(HotelUpdateSchema.parse({ logoAssetId: null })).toEqual({ logoAssetId: null });
  });

  it('accepte la mise à jour des dates valides ou d’une seule date', () => {
    expect(
      HotelUpdateSchema.safeParse({
        contractStart: '2026-06-01T00:00:00.000Z',
        contractEnd: '2026-12-31T00:00:00.000Z',
      }).success,
    ).toBe(true);

    expect(
      HotelUpdateSchema.safeParse({
        contractStart: '2026-06-01T00:00:00.000Z',
      }).success,
    ).toBe(true);

    expect(
      HotelUpdateSchema.safeParse({
        contractEnd: '2026-12-31T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('refuse des dates inversées si les deux sont fournies (dates inversées)', () => {
    const result = HotelUpdateSchema.safeParse({
      contractStart: '2027-01-01T00:00:00.000Z',
      contractEnd: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['contractEnd']);
    }
  });

  it('refuse une couleur invalide en mise à jour (couleur invalide)', () => {
    expect(HotelUpdateSchema.safeParse({ brandColor: 'violet' }).success).toBe(false);
  });

  it('refuse une langue inconnue, des doublons ou une liste vide en mise à jour (langue inconnue)', () => {
    expect(HotelUpdateSchema.safeParse({ languages: ['it'] }).success).toBe(false);
    expect(HotelUpdateSchema.safeParse({ languages: ['ar', 'ar'] }).success).toBe(false);
    expect(HotelUpdateSchema.safeParse({ languages: [] }).success).toBe(false);
  });
});

describe('HotelResponseSchema', () => {
  it('valide une réponse d’hôtel complète avec dates ISO et hasMaintenancePin (cas valide)', () => {
    const parsed = HotelResponseSchema.parse(validHotelResponse);
    expect(parsed).toEqual(validHotelResponse);
  });

  it('exclut JAMAIS maintenancePinHash et expose hasMaintenancePin (réponse sans maintenancePinHash)', () => {
    expect('maintenancePinHash' in HotelResponseSchema.shape).toBe(false);
    expect('hasMaintenancePin' in HotelResponseSchema.shape).toBe(true);

    const inputWithHash = {
      ...validHotelResponse,
      maintenancePinHash: '$argon2id$v=19$m=65536,t=3,p=4$someSecretHashValue',
    };
    const parsed = HotelResponseSchema.parse(inputWithHash);

    expect(parsed).not.toHaveProperty('maintenancePinHash');
    expect('maintenancePinHash' in parsed).toBe(false);
    expect(parsed.hasMaintenancePin).toBe(true);
  });

  it('refuse un id qui n’est pas un UUID', () => {
    expect(
      HotelResponseSchema.safeParse({ ...validHotelResponse, id: 'pas-un-uuid' }).success,
    ).toBe(false);
  });

  it('refuse une date de création ou de modification non ISO', () => {
    expect(
      HotelResponseSchema.safeParse({ ...validHotelResponse, createdAt: 'hier' }).success,
    ).toBe(false);
    expect(
      HotelResponseSchema.safeParse({ ...validHotelResponse, updatedAt: '12-05-2026' }).success,
    ).toBe(false);
  });
});

describe('HotelListResponseSchema', () => {
  it('accepte une liste de réponses d’hôtels (cas valide)', () => {
    const list = [validHotelResponse, { ...validHotelResponse, id: '01990000-0000-7000-8000-000000000102' }];
    const parsed = HotelListResponseSchema.parse(list);
    expect(parsed).toHaveLength(2);
    expect(HotelListResponseSchema.parse([])).toEqual([]);
  });

  it('refuse une liste contenant un élément invalide', () => {
    const invalidList = [validHotelResponse, { ...validHotelResponse, brandColor: 'rouge' }];
    expect(HotelListResponseSchema.safeParse(invalidList).success).toBe(false);
  });
});

describe('Exports depuis index.ts', () => {
  it('ré-exporte tous les schémas et énumérations d’hôtels', async () => {
    const shared = await import('./index.js');
    expect(shared.HotelCreateSchema).toBeDefined();
    expect(shared.HotelUpdateSchema).toBeDefined();
    expect(shared.HotelResponseSchema).toBeDefined();
    expect(shared.HotelListResponseSchema).toBeDefined();
    expect(shared.HotelStarsSchema).toBeDefined();
    expect(shared.ContractTypeSchema).toBeDefined();
    expect(shared.HotelStars).toBeDefined();
    expect(shared.ContractType).toBeDefined();
    expect(shared.hotelLanguagesSchema).toBeDefined();
  });
});
