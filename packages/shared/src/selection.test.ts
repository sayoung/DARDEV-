import { describe, expect, it } from 'vitest';

import {
  SelectionItemResponseSchema,
  SelectionItemSchema,
  SelectionResponseSchema,
  SelectionUpdateSchema,
} from './selection.js';

const validHotelId = '01990000-0000-7000-8000-000000000001';
const validTourId1 = '01990000-0000-7000-8000-000000000010';
const validTourId2 = '01990000-0000-7000-8000-000000000020';
const validTourId3 = '01990000-0000-7000-8000-000000000030';
const validIsoDate = '2026-10-16T12:00:00.000Z';

function generateValidUuids(count: number): string[] {
  const result: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const hex = i.toString(16).padStart(12, '0');
    result.push(`01990000-0000-7000-8000-${hex}`);
  }
  return result;
}

describe('SelectionUpdateSchema', () => {
  it('accepte une sélection complète et valide avec visite mise en avant et veilles (cas valide)', () => {
    const validData = {
      tourIds: [validTourId1, validTourId2, validTourId3],
      featuredTourId: validTourId1,
      attractTourIds: [validTourId2, validTourId3],
    };

    const parsed = SelectionUpdateSchema.parse(validData);
    expect(parsed).toEqual(validData);
  });

  it('accepte une sélection valide sans visite mise en avant (featuredTourId null)', () => {
    const validData = {
      tourIds: [validTourId1, validTourId2],
      featuredTourId: null,
      attractTourIds: [validTourId1],
    };

    const parsed = SelectionUpdateSchema.parse(validData);
    expect(parsed.featuredTourId).toBeNull();
    expect(parsed.tourIds).toEqual([validTourId1, validTourId2]);
  });

  it('accepte une sélection vide avec featuredTourId null et attractTourIds vide (sélection vide acceptée)', () => {
    const emptyData = {
      tourIds: [],
      featuredTourId: null,
      attractTourIds: [],
    };

    const parsed = SelectionUpdateSchema.parse(emptyData);
    expect(parsed).toEqual(emptyData);
    expect(parsed.tourIds).toHaveLength(0);
    expect(parsed.featuredTourId).toBeNull();
    expect(parsed.attractTourIds).toHaveLength(0);
  });

  it('refuse les doublons dans tourIds (doublon refusé)', () => {
    const duplicateTourIds = {
      tourIds: [validTourId1, validTourId2, validTourId1],
      featuredTourId: validTourId1,
      attractTourIds: [validTourId2],
    };

    const result = SelectionUpdateSchema.safeParse(duplicateTourIds);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['tourIds']);
      expect(result.error.issues[0]?.message).toContain('doublon');
    }
  });

  it('refuse les doublons dans attractTourIds (doublon refusé)', () => {
    const duplicateAttractTourIds = {
      tourIds: [validTourId1, validTourId2],
      featuredTourId: validTourId1,
      attractTourIds: [validTourId2, validTourId2],
    };

    const result = SelectionUpdateSchema.safeParse(duplicateAttractTourIds);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['attractTourIds']);
      expect(result.error.issues[0]?.message).toContain('doublon');
    }
  });

  it('refuse une visite mise en avant absente de tourIds (visite mise en avant absente de tourIds refusée)', () => {
    const missingFeatured = {
      tourIds: [validTourId1, validTourId2],
      featuredTourId: validTourId3,
      attractTourIds: [validTourId1],
    };

    const result = SelectionUpdateSchema.safeParse(missingFeatured);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['featuredTourId']);
      expect(result.error.issues[0]?.message).toBe(
        'La visite mise en avant doit figurer dans la sélection',
      );
    }
  });

  it('refuse une visite de veille absente de tourIds (visite de veille absente refusée)', () => {
    const missingAttract = {
      tourIds: [validTourId1, validTourId2],
      featuredTourId: validTourId1,
      attractTourIds: [validTourId3],
    };

    const result = SelectionUpdateSchema.safeParse(missingAttract);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['attractTourIds']);
      expect(result.error.issues[0]?.message).toBe(
        'Chaque visite de veille doit figurer dans la sélection',
      );
    }
  });

  it('refuse si l’une des visites de veille est absente de tourIds même si d’autres sont présentes', () => {
    const partiallyMissingAttract = {
      tourIds: [validTourId1, validTourId2],
      featuredTourId: null,
      attractTourIds: [validTourId1, validTourId3],
    };

    const result = SelectionUpdateSchema.safeParse(partiallyMissingAttract);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['attractTourIds']);
    }
  });

  it('accepte une sélection contenant exactement 200 visites distinctes', () => {
    const twoHundredUuids = generateValidUuids(200);
    const firstUuid = twoHundredUuids[0];
    const secondUuid = twoHundredUuids[1];

    const data = {
      tourIds: twoHundredUuids,
      featuredTourId: firstUuid ?? null,
      attractTourIds: secondUuid ? [secondUuid] : [],
    };

    const result = SelectionUpdateSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('refuse une sélection contenant plus de 200 visites (limite 200 dépassée)', () => {
    const twoHundredOneUuids = generateValidUuids(201);
    const firstUuid = twoHundredOneUuids[0];

    const data = {
      tourIds: twoHundredOneUuids,
      featuredTourId: firstUuid ?? null,
      attractTourIds: [],
    };

    const result = SelectionUpdateSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['tourIds']);
    }
  });

  it('refuse des identifiants qui ne sont pas des UUIDs', () => {
    expect(
      SelectionUpdateSchema.safeParse({
        tourIds: ['not-an-uuid'],
        featuredTourId: null,
        attractTourIds: [],
      }).success,
    ).toBe(false);

    expect(
      SelectionUpdateSchema.safeParse({
        tourIds: [validTourId1],
        featuredTourId: 'not-an-uuid',
        attractTourIds: [],
      }).success,
    ).toBe(false);

    expect(
      SelectionUpdateSchema.safeParse({
        tourIds: [validTourId1],
        featuredTourId: null,
        attractTourIds: ['not-an-uuid'],
      }).success,
    ).toBe(false);
  });

  it('refuse un featuredTourId undefined', () => {
    const result = SelectionUpdateSchema.safeParse({
      tourIds: [validTourId1],
      attractTourIds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('SelectionItemResponseSchema', () => {
  it('accepte un élément de sélection valide avec position >= 0', () => {
    const item = { tourId: validTourId1, position: 0 };
    const parsed = SelectionItemResponseSchema.parse(item);
    expect(parsed).toEqual(item);
  });

  it('l’alias SelectionItemSchema est équivalent', () => {
    const item = { tourId: validTourId1, position: 3 };
    const parsed = SelectionItemSchema.parse(item);
    expect(parsed).toEqual(item);
  });

  it('refuse un tourId non UUID', () => {
    const invalid = { tourId: 'invalid-id', position: 0 };
    expect(SelectionItemResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it('refuse une position négative ou non entière', () => {
    expect(
      SelectionItemResponseSchema.safeParse({ tourId: validTourId1, position: -1 }).success,
    ).toBe(false);
    expect(
      SelectionItemResponseSchema.safeParse({ tourId: validTourId1, position: 1.5 }).success,
    ).toBe(false);
  });
});

describe('SelectionResponseSchema', () => {
  it('valide une réponse complète de sélection avec éléments ordonnés (cas valide)', () => {
    const validResponse = {
      hotelId: validHotelId,
      version: 1,
      featuredTourId: validTourId1,
      attractTourIds: [validTourId2],
      items: [
        { tourId: validTourId1, position: 0 },
        { tourId: validTourId2, position: 1 },
      ],
      updatedAt: validIsoDate,
    };

    const parsed = SelectionResponseSchema.parse(validResponse);
    expect(parsed).toEqual(validResponse);
    expect(parsed.version).toBe(1);
    expect(parsed.items).toHaveLength(2);
  });

  it('valide une réponse de sélection vide avec featuredTourId null (sélection vide acceptée)', () => {
    const emptyResponse = {
      hotelId: validHotelId,
      version: 1,
      featuredTourId: null,
      attractTourIds: [],
      items: [],
      updatedAt: validIsoDate,
    };

    const parsed = SelectionResponseSchema.parse(emptyResponse);
    expect(parsed).toEqual(emptyResponse);
    expect(parsed.featuredTourId).toBeNull();
    expect(parsed.items).toEqual([]);
    expect(parsed.attractTourIds).toEqual([]);
  });

  it('refuse un hotelId qui n’est pas un UUID', () => {
    const invalid = {
      hotelId: 'not-an-uuid',
      version: 1,
      featuredTourId: null,
      attractTourIds: [],
      items: [],
      updatedAt: validIsoDate,
    };
    expect(SelectionResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it('refuse une version inférieure à 1 ou non entière', () => {
    const base = {
      hotelId: validHotelId,
      featuredTourId: null,
      attractTourIds: [],
      items: [],
      updatedAt: validIsoDate,
    };

    expect(SelectionResponseSchema.safeParse({ ...base, version: 0 }).success).toBe(false);
    expect(SelectionResponseSchema.safeParse({ ...base, version: -1 }).success).toBe(false);
    expect(SelectionResponseSchema.safeParse({ ...base, version: 1.5 }).success).toBe(false);
  });

  it('refuse un featuredTourId invalide (non null et non UUID)', () => {
    const invalid = {
      hotelId: validHotelId,
      version: 1,
      featuredTourId: 'not-an-uuid',
      attractTourIds: [],
      items: [],
      updatedAt: validIsoDate,
    };
    expect(SelectionResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it('refuse une date updatedAt non ISO 8601', () => {
    const invalid = {
      hotelId: validHotelId,
      version: 1,
      featuredTourId: null,
      attractTourIds: [],
      items: [],
      updatedAt: '2026/10/16 12:00:00',
    };
    expect(SelectionResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it('refuse des items contenant une position invalide', () => {
    const invalid = {
      hotelId: validHotelId,
      version: 1,
      featuredTourId: null,
      attractTourIds: [],
      items: [{ tourId: validTourId1, position: -1 }],
      updatedAt: validIsoDate,
    };
    expect(SelectionResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('Exports depuis index.ts', () => {
  it('ré-exporte tous les schémas et types de sélection', async () => {
    const shared = await import('./index.js');
    expect(shared.SelectionUpdateSchema).toBeDefined();
    expect(shared.SelectionResponseSchema).toBeDefined();
    expect(shared.SelectionItemResponseSchema).toBeDefined();
    expect(shared.SelectionItemSchema).toBeDefined();
  });
});
