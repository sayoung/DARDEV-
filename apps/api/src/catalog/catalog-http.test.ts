import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CityCreateSchema, Role, type Principal } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import type { SessionRequest } from '../auth/session-request.js';
import { parseBody, parseResourceId, requireCatalogWriter } from './catalog-http.js';

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
