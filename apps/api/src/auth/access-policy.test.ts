import { Role, type Principal } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import {
  canAccessHotel,
  canManageContent,
  canManageUsers,
  canViewRawStats,
  scopeHotelIds,
} from './access-policy.js';

const HOTEL_A = 'hotel-a';
const HOTEL_B = 'hotel-b';

function principal(role: Role, hotelIds: string[] = []): Principal {
  return { userId: 'user-1', role, hotelIds };
}

describe('canManageContent', () => {
  it('autorise ADMIN et EDITOR', () => {
    expect(canManageContent(principal(Role.ADMIN))).toBe(true);
    expect(canManageContent(principal(Role.EDITOR))).toBe(true);
  });

  it('refuse HOTEL_MANAGER et PARTNER', () => {
    expect(canManageContent(principal(Role.HOTEL_MANAGER, [HOTEL_A]))).toBe(false);
    expect(canManageContent(principal(Role.PARTNER, [HOTEL_A]))).toBe(false);
  });
});

describe('canManageUsers', () => {
  it('autorise seulement ADMIN', () => {
    expect(canManageUsers(principal(Role.ADMIN))).toBe(true);
    expect(canManageUsers(principal(Role.EDITOR))).toBe(false);
    expect(canManageUsers(principal(Role.HOTEL_MANAGER, [HOTEL_A]))).toBe(false);
    expect(canManageUsers(principal(Role.PARTNER, [HOTEL_A]))).toBe(false);
  });
});

describe('canAccessHotel', () => {
  it('autorise ADMIN pour tout hôtel', () => {
    const admin = principal(Role.ADMIN);
    expect(canAccessHotel(admin, HOTEL_A)).toBe(true);
    expect(canAccessHotel(admin, HOTEL_B)).toBe(true);
  });

  it("un gestionnaire de l'hôtel A ne voit pas l'hôtel B", () => {
    const manager = principal(Role.HOTEL_MANAGER, [HOTEL_A]);
    expect(canAccessHotel(manager, HOTEL_A)).toBe(true);
    expect(canAccessHotel(manager, HOTEL_B)).toBe(false);
  });

  it("un partenaire de l'hôtel A ne voit pas l'hôtel B", () => {
    const partner = principal(Role.PARTNER, [HOTEL_A]);
    expect(canAccessHotel(partner, HOTEL_A)).toBe(true);
    expect(canAccessHotel(partner, HOTEL_B)).toBe(false);
  });

  it("refuse EDITOR même si l'hôtel est listé", () => {
    const editor = principal(Role.EDITOR, [HOTEL_A, HOTEL_B]);
    expect(canAccessHotel(editor, HOTEL_A)).toBe(false);
    expect(canAccessHotel(editor, HOTEL_B)).toBe(false);
  });
});

describe('scopeHotelIds', () => {
  it('renvoie ALL pour ADMIN', () => {
    expect(scopeHotelIds(principal(Role.ADMIN, [HOTEL_A]))).toBe('ALL');
  });

  it('renvoie une liste vide pour EDITOR', () => {
    expect(scopeHotelIds(principal(Role.EDITOR, [HOTEL_A]))).toEqual([]);
  });

  it('renvoie les hôtels rattachés pour HOTEL_MANAGER et PARTNER', () => {
    expect(scopeHotelIds(principal(Role.HOTEL_MANAGER, [HOTEL_A]))).toEqual([HOTEL_A]);
    expect(scopeHotelIds(principal(Role.PARTNER, [HOTEL_A, HOTEL_B]))).toEqual([HOTEL_A, HOTEL_B]);
  });
});

describe('canViewRawStats', () => {
  it('refuse PARTNER (D-04)', () => {
    expect(canViewRawStats(principal(Role.PARTNER, [HOTEL_A]))).toBe(false);
  });

  it('autorise les autres rôles', () => {
    expect(canViewRawStats(principal(Role.ADMIN))).toBe(true);
    expect(canViewRawStats(principal(Role.EDITOR))).toBe(true);
    expect(canViewRawStats(principal(Role.HOTEL_MANAGER, [HOTEL_A]))).toBe(true);
  });
});
