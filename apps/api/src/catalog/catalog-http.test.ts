import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AssetKind, CityCreateSchema, Role, TourStatus, type Principal } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import type { SessionRequest } from '../auth/session-request.js';
import {
  parseAssetFoldersQuery,
  parseAssetListQuery,
  parseBody,
  parseResourceId,
  parseTourListQuery,
  requireCatalogWriter,
  requireContentManager,
} from './catalog-http.js';

const CITY_ID = '01990000-0000-7000-8000-000000000001';

function request(principal?: Principal): SessionRequest {
  return { method: 'POST', headers: {}, principal };
}

function principal(role: Role): Principal {
  return { userId: 'user-1', role, hotelIds: [] };
}

describe('requireCatalogWriter', () => {
  it('laisse passer ADMIN et EDITOR', () => {
    expect(() => {
      requireCatalogWriter(request(principal(Role.ADMIN)));
    }).not.toThrow();
    expect(() => {
      requireCatalogWriter(request(principal(Role.EDITOR)));
    }).not.toThrow();
  });

  it('refuse une session sans principal, PARTNER et HOTEL_MANAGER', () => {
    expect(() => {
      requireCatalogWriter(request());
    }).toThrow(ForbiddenException);
    expect(() => {
      requireCatalogWriter(request(principal(Role.PARTNER)));
    }).toThrow(ForbiddenException);
    expect(() => {
      requireCatalogWriter(request(principal(Role.HOTEL_MANAGER)));
    }).toThrow(ForbiddenException);
  });
});

describe('requireContentManager', () => {
  it('laisse passer ADMIN et EDITOR et renvoie le principal', () => {
    const admin = principal(Role.ADMIN);
    expect(requireContentManager(request(admin))).toEqual(admin);
    expect(requireContentManager(request(principal(Role.EDITOR))).role).toBe(Role.EDITOR);
  });

  it('refuse une session sans principal, PARTNER et HOTEL_MANAGER', () => {
    expect(() => {
      requireContentManager(request());
    }).toThrow(ForbiddenException);
    expect(() => {
      requireContentManager(request(principal(Role.PARTNER)));
    }).toThrow(ForbiddenException);
    expect(() => {
      requireContentManager(request(principal(Role.HOTEL_MANAGER)));
    }).toThrow(ForbiddenException);
  });
});

describe('parseTourListQuery', () => {
  it('pose page à 1 et pageSize à 20 quand la query est vide', () => {
    expect(parseTourListQuery({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('convertit les chaînes numériques et garde les filtres', () => {
    expect(
      parseTourListQuery({
        page: '2',
        pageSize: ['10', '20'],
        status: TourStatus.DRAFT,
        cityId: CITY_ID,
        q: 'kasbah',
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      status: TourStatus.DRAFT,
      cityId: CITY_ID,
      q: 'kasbah',
    });
  });

  it('refuse une page qui n’est pas un entier', () => {
    expect(() => parseTourListQuery({ page: '1.5' })).toThrow(BadRequestException);
    expect(() => parseTourListQuery({ status: 'ARCHIVED' })).toThrow(BadRequestException);
  });
});

describe('parseAssetListQuery', () => {
  it('pose page à 1 et pageSize à 20 quand la query est vide', () => {
    expect(parseAssetListQuery({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('convertit les chaînes numériques et garde le kind', () => {
    expect(
      parseAssetListQuery({
        page: '2',
        pageSize: ['10', '20'],
        kind: [AssetKind.AUDIO, AssetKind.IMAGE],
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      kind: AssetKind.AUDIO,
    });
  });

  it('transmet tourId et unused', () => {
    expect(
      parseAssetListQuery({
        tourId: CITY_ID,
        unused: 'true',
      }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      tourId: CITY_ID,
      unused: 'true',
    });
  });

  it('refuse un kind inconnu', () => {
    expect(() => parseAssetListQuery({ kind: 'GIF' })).toThrow(BadRequestException);
  });
});

describe('parseAssetFoldersQuery', () => {
  it('accepte une query vide', () => {
    expect(parseAssetFoldersQuery({})).toEqual({});
  });

  it('transmet le kind', () => {
    expect(parseAssetFoldersQuery({ kind: AssetKind.IMAGE })).toEqual({ kind: AssetKind.IMAGE });
  });

  it('refuse un kind inconnu', () => {
    expect(() => parseAssetFoldersQuery({ kind: 'GIF' })).toThrow(BadRequestException);
  });
});

describe('parseBody', () => {
  it('accepte un corps de ville valide', () => {
    const body = {
      name: { fr: 'Rabat' },
      region: 'Rabat-Salé-Kénitra',
      lat: 34,
      lng: -6,
    };
    expect(parseBody(CityCreateSchema, body)).toEqual(body);
  });

  it('refuse un corps incomplet', () => {
    expect(() => parseBody(CityCreateSchema, { name: { fr: 'Rabat' } })).toThrow(
      BadRequestException,
    );
  });
});

describe('parseResourceId', () => {
  it('accepte un UUID v7', () => {
    expect(parseResourceId(CITY_ID)).toBe(CITY_ID);
  });

  it('refuse un identifiant qui n’est pas un UUID v7', () => {
    expect(() => parseResourceId('pas-un-uuid')).toThrow(BadRequestException);
    expect(() => parseResourceId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toThrow(
      BadRequestException,
    );
  });
});
