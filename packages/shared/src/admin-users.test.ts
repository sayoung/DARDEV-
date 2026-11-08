import { describe, expect, it } from 'vitest';

import {
  AdminUserListQuerySchema,
  AdminUserSchema,
  PaginatedAdminUsersResponseSchema,
  SetUserHotelsRequestSchema,
  UpdateAdminUserRequestSchema,
} from './admin-users.js';
import { Role } from './role.js';

const validUserId = '01990000-0000-7000-8000-000000000001';
const validHotelId1 = '01990000-0000-7000-8000-000000000101';
const validHotelId2 = '01990000-0000-7000-8000-000000000102';
const validIsoDatetime = '2026-11-08T12:00:00.000Z';

const sampleAdminUser = {
  id: validUserId,
  email: 'admin@xplor.local',
  name: 'Sara Idrissi',
  role: Role.ADMIN,
  active: true,
  totpEnabled: false,
  lastLoginAt: validIsoDatetime,
  uiLang: 'fr' as const,
  hotelIds: [validHotelId1, validHotelId2],
};

describe('AdminUserSchema', () => {
  it('valide un utilisateur administrateur complet', () => {
    const result = AdminUserSchema.safeParse(sampleAdminUser);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(validUserId);
      expect(result.data.email).toBe('admin@xplor.local');
      expect(result.data.role).toBe(Role.ADMIN);
      expect(result.data.active).toBe(true);
      expect(result.data.totpEnabled).toBe(false);
      expect(result.data.lastLoginAt).toBe(validIsoDatetime);
      expect(result.data.uiLang).toBe('fr');
      expect(result.data.hotelIds).toEqual([validHotelId1, validHotelId2]);
    }
  });

  it('valide un utilisateur sans dernière connexion (lastLoginAt à null) et sans hôtels', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      lastLoginAt: null,
      hotelIds: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastLoginAt).toBeNull();
      expect(result.data.hotelIds).toEqual([]);
    }
  });

  it('refuse un id qui n’est pas un uuid valide (uuid invalide refusé)', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      id: 'not-a-valid-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un email invalide', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un nom vide ou uniquement composé d’espaces', () => {
    expect(AdminUserSchema.safeParse({ ...sampleAdminUser, name: '' }).success).toBe(false);
    expect(AdminUserSchema.safeParse({ ...sampleAdminUser, name: '   ' }).success).toBe(false);
  });

  it('refuse un rôle inconnu (rôle inconnu refusé)', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      role: 'SUPER_ADMIN',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un champ active non booléen', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      active: 'true',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un champ totpEnabled non booléen', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      totpEnabled: 'false',
    });
    expect(result.success).toBe(false);
  });

  it('refuse une date lastLoginAt qui n’est pas une chaîne ISO', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      lastLoginAt: 'hier à 14h',
    });
    expect(result.success).toBe(false);
  });

  it('refuse une langue d’interface hors de packages/shared/src/lang.ts', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      uiLang: 'es',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un identifiant hôtel qui n’est pas un uuid valide', () => {
    const result = AdminUserSchema.safeParse({
      ...sampleAdminUser,
      hotelIds: ['invalid-hotel-uuid'],
    });
    expect(result.success).toBe(false);
  });

  it('n’expose ni passwordHash ni totpSecret dans sa définition de schéma', () => {
    expect('passwordHash' in AdminUserSchema.shape).toBe(false);
    expect('totpSecret' in AdminUserSchema.shape).toBe(false);
  });
});

describe('UpdateAdminUserRequestSchema', () => {
  it('refuse un objet vide pour la mise à jour (objet vide refusé pour la mise à jour)', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Au moins un champ doit être fourni pour la mise à jour',
      );
    }
  });

  it('accepte une mise à jour avec uniquement le nom', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({ name: 'Nouveau Nom' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Nouveau Nom');
    }
  });

  it('accepte une mise à jour avec uniquement le rôle', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({ role: Role.EDITOR });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe(Role.EDITOR);
    }
  });

  it('accepte une mise à jour avec uniquement le statut actif', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({ active: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(false);
    }
  });

  it('accepte une mise à jour avec uniquement la langue', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({ uiLang: 'ar' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.uiLang).toBe('ar');
    }
  });

  it('accepte une mise à jour combinant tous les champs modifiables', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({
      name: 'Youssef Alami',
      role: Role.HOTEL_MANAGER,
      active: true,
      uiLang: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('refuse un nom vide dans la mise à jour', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('refuse un rôle inconnu dans la mise à jour (rôle inconnu refusé)', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({ role: 'UNKNOWN_ROLE' });
    expect(result.success).toBe(false);
  });

  it('refuse une langue d’interface invalide dans la mise à jour', () => {
    const result = UpdateAdminUserRequestSchema.safeParse({ uiLang: 'de' });
    expect(result.success).toBe(false);
  });
});

describe('SetUserHotelsRequestSchema', () => {
  it('accepte une liste d’identifiants d’hôtels au format uuid', () => {
    const result = SetUserHotelsRequestSchema.safeParse({
      hotelIds: [validHotelId1, validHotelId2],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hotelIds).toEqual([validHotelId1, validHotelId2]);
    }
  });

  it('accepte une liste vide pour détacher tous les hôtels', () => {
    const result = SetUserHotelsRequestSchema.safeParse({ hotelIds: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hotelIds).toEqual([]);
    }
  });

  it('refuse un uuid invalide dans hotelIds (uuid invalide refusé)', () => {
    const result = SetUserHotelsRequestSchema.safeParse({
      hotelIds: [validHotelId1, 'not-a-valid-uuid'],
    });
    expect(result.success).toBe(false);
  });

  it('refuse un objet sans hotelIds ou avec hotelIds non-tableau', () => {
    expect(SetUserHotelsRequestSchema.safeParse({}).success).toBe(false);
    expect(SetUserHotelsRequestSchema.safeParse({ hotelIds: validHotelId1 }).success).toBe(false);
  });
});

describe('AdminUserListQuerySchema', () => {
  it('applique les valeurs par défaut (page: 1, pageSize: 20) sur une requête vide', () => {
    const result = AdminUserListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.role).toBeUndefined();
      expect(result.data.active).toBeUndefined();
      expect(result.data.q).toBeUndefined();
    }
  });

  it('accepte des paramètres personnalisés complets', () => {
    const result = AdminUserListQuerySchema.safeParse({
      page: 3,
      pageSize: 50,
      role: Role.PARTNER,
      active: true,
      q: 'karim',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
      expect(result.data.role).toBe(Role.PARTNER);
      expect(result.data.active).toBe(true);
      expect(result.data.q).toBe('karim');
    }
  });

  it('refuse un pageSize supérieur à 100 (pageSize 101 refusé)', () => {
    const result = AdminUserListQuerySchema.safeParse({ pageSize: 101 });
    expect(result.success).toBe(false);
  });

  it('accepte les bornes de pageSize (1 et 100)', () => {
    expect(AdminUserListQuerySchema.safeParse({ pageSize: 1 }).success).toBe(true);
    expect(AdminUserListQuerySchema.safeParse({ pageSize: 100 }).success).toBe(true);
  });

  it('refuse un pageSize inférieur à 1 ou non entier', () => {
    expect(AdminUserListQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(AdminUserListQuerySchema.safeParse({ pageSize: -10 }).success).toBe(false);
    expect(AdminUserListQuerySchema.safeParse({ pageSize: 15.5 }).success).toBe(false);
  });

  it('refuse une page inférieure à 1 ou non entière', () => {
    expect(AdminUserListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(AdminUserListQuerySchema.safeParse({ page: -1 }).success).toBe(false);
    expect(AdminUserListQuerySchema.safeParse({ page: 2.5 }).success).toBe(false);
  });

  it('refuse un rôle inconnu dans la query (rôle inconnu refusé)', () => {
    const result = AdminUserListQuerySchema.safeParse({ role: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });

  it('coerce correctement la chaîne "true" en booléen true', () => {
    const result = AdminUserListQuerySchema.safeParse({ active: 'true' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(true);
    }
  });

  it('coerce correctement la chaîne "1" en booléen true', () => {
    const result = AdminUserListQuerySchema.safeParse({ active: '1' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(true);
    }
  });

  it('coerce correctement la chaîne "false" en booléen false', () => {
    const result = AdminUserListQuerySchema.safeParse({ active: 'false' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(false);
    }
  });

  it('coerce correctement la chaîne "0" en booléen false', () => {
    const result = AdminUserListQuerySchema.safeParse({ active: '0' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(false);
    }
  });

  it('coerce les autres chaînes non réservées via la coercition booléenne Zod standard', () => {
    const result = AdminUserListQuerySchema.safeParse({ active: 'other' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(true);
    }
  });

  it('accepte les booléens natifs true et false pour active', () => {
    const resultTrue = AdminUserListQuerySchema.safeParse({ active: true });
    expect(resultTrue.success).toBe(true);
    if (resultTrue.success) {
      expect(resultTrue.data.active).toBe(true);
    }

    const resultFalse = AdminUserListQuerySchema.safeParse({ active: false });
    expect(resultFalse.success).toBe(true);
    if (resultFalse.success) {
      expect(resultFalse.data.active).toBe(false);
    }
  });
});

describe('PaginatedAdminUsersResponseSchema', () => {
  it('valide une réponse paginée contenant des utilisateurs', () => {
    const payload = {
      items: [sampleAdminUser],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    const result = PaginatedAdminUsersResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('valide une réponse paginée avec liste vide et total à zéro', () => {
    const result = PaginatedAdminUsersResponseSchema.safeParse({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
  });

  it('refuse un total négatif', () => {
    const result = PaginatedAdminUsersResponseSchema.safeParse({
      items: [],
      total: -1,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });

  it('refuse une page inférieure à 1', () => {
    const result = PaginatedAdminUsersResponseSchema.safeParse({
      items: [],
      total: 0,
      page: 0,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });

  it('refuse un pageSize supérieur à 100', () => {
    const result = PaginatedAdminUsersResponseSchema.safeParse({
      items: [],
      total: 0,
      page: 1,
      pageSize: 101,
    });
    expect(result.success).toBe(false);
  });

  it('refuse un élément de items non conforme à AdminUserSchema', () => {
    const result = PaginatedAdminUsersResponseSchema.safeParse({
      items: [{ id: 'not-a-valid-user' }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });
});
