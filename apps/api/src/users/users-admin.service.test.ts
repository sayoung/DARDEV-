import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type AuditRecorder } from '../audit/audit-recorder.js';

import {
  USER_ADMIN_SELECT,
  UsersAdminService,
  buildUserAdminWhereInput,
  toAdminUser,
  type UserAdminCountArgs,
  type UserAdminFindManyArgs,
  type UserAdminFindUniqueArgs,
  type UserAdminRow,
  type UserAdminUpdateArgs,
  type UsersAdminPrismaClient,
} from './users-admin.service.js';

interface FakeUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  totpSecret: string | null;
  role: PrismaRole;
  active: boolean;
  totpEnabled: boolean;
  lastLoginAt: Date | string | null;
  uiLang: string;
  createdAt: Date;
  hotels: { hotelId: string }[];
}

function isPrismaRole(value: unknown): value is PrismaRole {
  return (
    value === PrismaRole.ADMIN ||
    value === PrismaRole.EDITOR ||
    value === PrismaRole.HOTEL_MANAGER ||
    value === PrismaRole.PARTNER
  );
}

class FakeUsersAdminPrismaClient implements UsersAdminPrismaClient {
  public findManyCalls: UserAdminFindManyArgs[] = [];
  public countCalls: UserAdminCountArgs[] = [];
  public findUniqueCalls: UserAdminFindUniqueArgs[] = [];
  public updateCalls: UserAdminUpdateArgs[] = [];
  public records: FakeUserRecord[] = [];

  constructor(records: FakeUserRecord[] = []) {
    this.records = records.map((record) => ({
      ...record,
      hotels: [...record.hotels],
    }));
  }

  public readonly user = {
    findMany: (args?: UserAdminFindManyArgs): Promise<UserAdminRow[]> => {
      const callArgs: UserAdminFindManyArgs = args ?? {};
      this.findManyCalls.push(callArgs);

      let filtered = [...this.records];
      const where = callArgs.where;
      if (where !== undefined) {
        filtered = filtered.filter((item) => this.matchesWhere(item, where));
      }

      filtered.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

      const skip = callArgs.skip ?? 0;
      const take = callArgs.take ?? filtered.length;
      const paged = filtered.slice(skip, skip + take);

      const rows: UserAdminRow[] = paged.map((item) => ({
        id: item.id,
        email: item.email,
        name: item.name,
        role: item.role,
        active: item.active,
        totpEnabled: item.totpEnabled,
        lastLoginAt: item.lastLoginAt,
        uiLang: item.uiLang,
        hotels: item.hotels,
      }));

      return Promise.resolve(rows);
    },

    count: (args?: UserAdminCountArgs): Promise<number> => {
      const callArgs: UserAdminCountArgs = args ?? {};
      this.countCalls.push(callArgs);

      const where = callArgs.where;
      if (where === undefined) {
        return Promise.resolve(this.records.length);
      }
      const filtered = this.records.filter((item) => this.matchesWhere(item, where));
      return Promise.resolve(filtered.length);
    },

    findUnique: (args: UserAdminFindUniqueArgs): Promise<UserAdminRow | null> => {
      this.findUniqueCalls.push(args);
      const targetId = args.where.id;
      if (targetId === undefined) {
        return Promise.resolve(null);
      }

      for (const record of this.records) {
        if (record.id === targetId) {
          const row: UserAdminRow = {
            id: record.id,
            email: record.email,
            name: record.name,
            role: record.role,
            active: record.active,
            totpEnabled: record.totpEnabled,
            lastLoginAt: record.lastLoginAt,
            uiLang: record.uiLang,
            hotels: record.hotels,
          };
          return Promise.resolve(row);
        }
      }

      return Promise.resolve(null);
    },

    update: (args: UserAdminUpdateArgs): Promise<UserAdminRow> => {
      this.updateCalls.push(args);
      const targetId = args.where.id;
      if (targetId === undefined) {
        return Promise.reject(new Error('Missing id in where clause'));
      }

      const index = this.records.findIndex((item) => item.id === targetId);
      if (index === -1) {
        return Promise.reject(new Error(`User not found: ${targetId}`));
      }

      const existing = this.records[index];
      if (existing === undefined) {
        return Promise.reject(new Error(`User not found: ${targetId}`));
      }

      const data = args.data;
      const name = typeof data.name === 'string' ? data.name : existing.name;
      const role = isPrismaRole(data.role) ? data.role : existing.role;
      const active = typeof data.active === 'boolean' ? data.active : existing.active;
      const uiLang = typeof data.uiLang === 'string' ? data.uiLang : existing.uiLang;

      const updatedRecord: FakeUserRecord = {
        ...existing,
        name,
        role,
        active,
        uiLang,
      };

      this.records[index] = updatedRecord;

      const row: UserAdminRow = {
        id: updatedRecord.id,
        email: updatedRecord.email,
        name: updatedRecord.name,
        role: updatedRecord.role,
        active: updatedRecord.active,
        totpEnabled: updatedRecord.totpEnabled,
        lastLoginAt: updatedRecord.lastLoginAt,
        uiLang: updatedRecord.uiLang,
        hotels: updatedRecord.hotels,
      };

      return Promise.resolve(row);
    },
  };

  private matchesWhere(item: FakeUserRecord, where: Prisma.UserWhereInput): boolean {
    if (where.role !== undefined && item.role !== where.role) {
      return false;
    }
    if (where.active !== undefined && item.active !== where.active) {
      return false;
    }
    if (where.OR !== undefined && Array.isArray(where.OR)) {
      const matchesOr = where.OR.some((clause) => {
        const emailNeedle = extractNeedle(clause.email);
        if (emailNeedle !== null && item.email.toLowerCase().includes(emailNeedle.toLowerCase())) {
          return true;
        }
        const nameNeedle = extractNeedle(clause.name);
        if (nameNeedle !== null && item.name.toLowerCase().includes(nameNeedle.toLowerCase())) {
          return true;
        }
        return false;
      });
      if (!matchesOr) {
        return false;
      }
    }
    return true;
  }
}

function extractNeedle(filter: unknown): string | null {
  if (typeof filter === 'string') {
    return filter;
  }
  if (typeof filter === 'object' && filter !== null && 'contains' in filter) {
    const candidate = filter.contains;
    if (typeof candidate === 'string') {
      return candidate;
    }
  }
  return null;
}

const USER_ID_1 = '01990000-0000-7000-8000-000000000001';
const USER_ID_2 = '01990000-0000-7000-8000-000000000002';
const USER_ID_3 = '01990000-0000-7000-8000-000000000003';
const USER_ID_4 = '01990000-0000-7000-8000-000000000004';
const USER_ID_5 = '01990000-0000-7000-8000-000000000005';
const UNKNOWN_USER_ID = '01990000-0000-7000-8000-000000000099';

const HOTEL_ID_1 = '01990000-0000-7000-8000-000000000101';
const HOTEL_ID_2 = '01990000-0000-7000-8000-000000000102';

const sampleRecords: FakeUserRecord[] = [
  {
    id: USER_ID_1,
    email: 'admin@xplor.local',
    name: 'Sara Idrissi',
    passwordHash: '$2b$12$secretPasswordHashAdmin',
    totpSecret: 'SECRETADMIN123456',
    role: PrismaRole.ADMIN,
    active: true,
    totpEnabled: true,
    lastLoginAt: new Date('2026-11-08T10:00:00.000Z'),
    uiLang: 'fr',
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
    hotels: [],
  },
  {
    id: USER_ID_2,
    email: 'karim.bennani@xplor.local',
    name: 'Karim Bennani',
    passwordHash: '$2b$12$secretPasswordHashKarim',
    totpSecret: null,
    role: PrismaRole.HOTEL_MANAGER,
    active: true,
    totpEnabled: false,
    lastLoginAt: new Date('2026-11-07T09:00:00.000Z'),
    uiLang: 'ar',
    createdAt: new Date('2026-11-02T12:00:00.000Z'),
    hotels: [{ hotelId: HOTEL_ID_1 }, { hotelId: HOTEL_ID_2 }],
  },
  {
    id: USER_ID_3,
    email: 'zineb.chraibi@xplor.local',
    name: 'Zineb Chraibi',
    passwordHash: '$2b$12$secretPasswordHashZineb',
    totpSecret: null,
    role: PrismaRole.HOTEL_MANAGER,
    active: false,
    totpEnabled: false,
    lastLoginAt: null,
    uiLang: 'fr',
    createdAt: new Date('2026-11-03T12:00:00.000Z'),
    hotels: [{ hotelId: HOTEL_ID_1 }],
  },
  {
    id: USER_ID_4,
    email: 'youssef.editor@xplor.local',
    name: 'Youssef El Amrani',
    passwordHash: '$2b$12$secretPasswordHashYoussef',
    totpSecret: null,
    role: PrismaRole.EDITOR,
    active: true,
    totpEnabled: false,
    lastLoginAt: '2026-11-06T15:30:00.000Z',
    uiLang: 'en',
    createdAt: new Date('2026-11-04T12:00:00.000Z'),
    hotels: [],
  },
  {
    id: USER_ID_5,
    email: 'mehdi.partner@xplor.local',
    name: 'Mehdi Alami',
    passwordHash: '$2b$12$secretPasswordHashMehdi',
    totpSecret: null,
    role: PrismaRole.PARTNER,
    active: false,
    totpEnabled: false,
    lastLoginAt: null,
    uiLang: 'es',
    createdAt: new Date('2026-11-05T12:00:00.000Z'),
    hotels: [],
  },
];

describe('UsersAdminService', () => {
  let fakePrisma: FakeUsersAdminPrismaClient;
  let service: UsersAdminService;

  beforeEach(() => {
    fakePrisma = new FakeUsersAdminPrismaClient(sampleRecords);
    service = new UsersAdminService(fakePrisma);
  });

  describe('list', () => {
    it('liste les utilisateurs par défaut avec tri par createdAt décroissant et pagination par défaut', async () => {
      const response = await service.list();

      expect(response.total).toBe(5);
      expect(response.page).toBe(1);
      expect(response.pageSize).toBe(20);
      expect(response.items).toHaveLength(5);

      // Du plus récent (USER_ID_5, créé le 05/11) au plus ancien (USER_ID_1, créé le 01/11)
      const first = response.items[0];
      const last = response.items[4];
      expect(first?.id).toBe(USER_ID_5);
      expect(last?.id).toBe(USER_ID_1);

      expect(fakePrisma.findManyCalls).toHaveLength(1);
      const call = fakePrisma.findManyCalls[0];
      expect(call?.orderBy).toEqual({ createdAt: 'desc' });
      expect(call?.skip).toBe(0);
      expect(call?.take).toBe(20);
      expect(call?.select).toEqual(USER_ADMIN_SELECT);
    });

    it('filtre par rôle', async () => {
      const response = await service.list({ role: Role.HOTEL_MANAGER });

      expect(response.total).toBe(2);
      expect(response.items).toHaveLength(2);
      for (const item of response.items) {
        expect(item.role).toBe(Role.HOTEL_MANAGER);
      }

      const call = fakePrisma.findManyCalls[0];
      expect(call?.where?.role).toBe(PrismaRole.HOTEL_MANAGER);
    });

    it('filtre par statut actif (active: true)', async () => {
      const response = await service.list({ active: true });

      expect(response.total).toBe(3);
      expect(response.items).toHaveLength(3);
      for (const item of response.items) {
        expect(item.active).toBe(true);
      }

      const call = fakePrisma.findManyCalls[0];
      expect(call?.where?.active).toBe(true);
    });

    it('filtre par statut inactif (active: false)', async () => {
      const response = await service.list({ active: false });

      expect(response.total).toBe(2);
      expect(response.items).toHaveLength(2);
      for (const item of response.items) {
        expect(item.active).toBe(false);
      }

      const call = fakePrisma.findManyCalls[0];
      expect(call?.where?.active).toBe(false);
    });

    it('filtre par recherche q insensible à la casse sur l’e-mail', async () => {
      // Recherche avec casse mixte
      const response = await service.list({ q: 'KaRiM.bEnNaNi' });

      expect(response.total).toBe(1);
      const item = response.items[0];
      expect(item?.id).toBe(USER_ID_2);
      expect(item?.email).toBe('karim.bennani@xplor.local');

      const call = fakePrisma.findManyCalls[0];
      expect(call?.where?.OR).toEqual([
        { email: { contains: 'KaRiM.bEnNaNi', mode: 'insensitive' } },
        { name: { contains: 'KaRiM.bEnNaNi', mode: 'insensitive' } },
      ]);
    });

    it('filtre par recherche q insensible à la casse sur le nom', async () => {
      // Recherche en majuscules
      const response = await service.list({ q: 'IDRISSI' });

      expect(response.total).toBe(1);
      const item = response.items[0];
      expect(item?.id).toBe(USER_ID_1);
      expect(item?.name).toBe('Sara Idrissi');
    });

    it('combine les filtres rôle, actif et recherche textuelle', async () => {
      const response = await service.list({
        role: Role.HOTEL_MANAGER,
        active: true,
        q: 'bennani',
      });

      expect(response.total).toBe(1);
      const item = response.items[0];
      expect(item?.id).toBe(USER_ID_2);
      expect(item?.role).toBe(Role.HOTEL_MANAGER);
      expect(item?.active).toBe(true);
    });

    it('pagine correctement les résultats (page 1 et page 2)', async () => {
      const page1 = await service.list({ page: 1, pageSize: 2 });
      expect(page1.total).toBe(5);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);
      expect(page1.items).toHaveLength(2);
      expect(page1.items[0]?.id).toBe(USER_ID_5);
      expect(page1.items[1]?.id).toBe(USER_ID_4);

      const page2 = await service.list({ page: 2, pageSize: 2 });
      expect(page2.total).toBe(5);
      expect(page2.page).toBe(2);
      expect(page2.pageSize).toBe(2);
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0]?.id).toBe(USER_ID_3);
      expect(page2.items[1]?.id).toBe(USER_ID_2);

      const call2 = fakePrisma.findManyCalls[1];
      expect(call2?.skip).toBe(2);
      expect(call2?.take).toBe(2);
    });

    it('renvoie une liste vide lorsque la page dépasse le nombre d’enregistrements', async () => {
      const response = await service.list({ page: 10, pageSize: 2 });
      expect(response.total).toBe(5);
      expect(response.page).toBe(10);
      expect(response.items).toHaveLength(0);
    });

    it('rejette les paramètres de pagination invalides avec BadRequestException', async () => {
      await expect(service.list({ page: 0 })).rejects.toThrow(BadRequestException);
      await expect(service.list({ pageSize: 0 })).rejects.toThrow(BadRequestException);
      await expect(service.list({ pageSize: 101 })).rejects.toThrow(BadRequestException);
      await expect(service.list({ role: 'INVALID_ROLE' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('get', () => {
    it('renvoie l’utilisateur avec ses hôtels rattachés (via UserHotel)', async () => {
      const user = await service.get(USER_ID_2);

      expect(user.id).toBe(USER_ID_2);
      expect(user.email).toBe('karim.bennani@xplor.local');
      expect(user.name).toBe('Karim Bennani');
      expect(user.role).toBe(Role.HOTEL_MANAGER);
      expect(user.active).toBe(true);
      expect(user.totpEnabled).toBe(false);
      expect(user.lastLoginAt).toBe('2026-11-07T09:00:00.000Z');
      expect(user.uiLang).toBe('ar');
      expect(user.hotelIds).toEqual([HOTEL_ID_1, HOTEL_ID_2]);

      expect(fakePrisma.findUniqueCalls).toHaveLength(1);
      const call = fakePrisma.findUniqueCalls[0];
      expect(call?.where.id).toBe(USER_ID_2);
      expect(call?.select).toEqual(USER_ADMIN_SELECT);
    });

    it('renvoie une liste vide hotelIds pour un utilisateur sans rattachement', async () => {
      const user = await service.get(USER_ID_1);

      expect(user.id).toBe(USER_ID_1);
      expect(user.hotelIds).toEqual([]);
      expect(user.lastLoginAt).toBe('2026-11-08T10:00:00.000Z');
    });

    it('renvoie null pour lastLoginAt si l’utilisateur ne s’est jamais connecté', async () => {
      const user = await service.get(USER_ID_3);

      expect(user.id).toBe(USER_ID_3);
      expect(user.lastLoginAt).toBeNull();
      expect(user.hotelIds).toEqual([HOTEL_ID_1]);
    });

    it('applique le repli sur fr pour une langue uiLang inconnue en base', async () => {
      const user = await service.get(USER_ID_5);

      expect(user.id).toBe(USER_ID_5);
      expect(user.uiLang).toBe('fr');
    });

    it('lève NotFoundException lorsque l’utilisateur n’existe pas', async () => {
      await expect(service.get(UNKNOWN_USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('met à jour le nom avec succès et retourne l’utilisateur mis à jour', async () => {
      const updated = await service.update(USER_ID_1, USER_ID_2, {
        name: 'Karim Mis À Jour',
      });

      expect(updated.id).toBe(USER_ID_2);
      expect(updated.name).toBe('Karim Mis À Jour');
      expect(updated.email).toBe('karim.bennani@xplor.local');
      expect(updated.role).toBe(Role.HOTEL_MANAGER);
      expect(updated.active).toBe(true);
      expect(updated.uiLang).toBe('ar');
      expect(updated.hotelIds).toEqual([HOTEL_ID_1, HOTEL_ID_2]);

      expect(fakePrisma.updateCalls).toHaveLength(1);
      const call = fakePrisma.updateCalls[0];
      expect(call?.where.id).toBe(USER_ID_2);
      expect(call?.data).toEqual({ name: 'Karim Mis À Jour' });
      expect(call?.select).toEqual(USER_ADMIN_SELECT);
    });

    it('met à jour le rôle avec succès', async () => {
      const updated = await service.update(USER_ID_1, USER_ID_2, {
        role: Role.EDITOR,
      });

      expect(updated.id).toBe(USER_ID_2);
      expect(updated.role).toBe(Role.EDITOR);

      const call = fakePrisma.updateCalls[0];
      expect(call?.data).toEqual({ role: PrismaRole.EDITOR });
    });

    it('met à jour le statut actif d’un non-admin avec succès (désactivation)', async () => {
      const updated = await service.update(USER_ID_1, USER_ID_2, {
        active: false,
      });

      expect(updated.id).toBe(USER_ID_2);
      expect(updated.active).toBe(false);

      const call = fakePrisma.updateCalls[0];
      expect(call?.data).toEqual({ active: false });
    });

    it('met à jour uiLang avec succès', async () => {
      const updated = await service.update(USER_ID_1, USER_ID_2, {
        uiLang: 'en',
      });

      expect(updated.id).toBe(USER_ID_2);
      expect(updated.uiLang).toBe('en');

      const call = fakePrisma.updateCalls[0];
      expect(call?.data).toEqual({ uiLang: 'en' });
    });

    it('met à jour plusieurs champs simultanément avec succès', async () => {
      const updated = await service.update(USER_ID_1, USER_ID_4, {
        name: 'Youssef Modifié',
        role: Role.HOTEL_MANAGER,
        active: false,
        uiLang: 'fr',
      });

      expect(updated.id).toBe(USER_ID_4);
      expect(updated.name).toBe('Youssef Modifié');
      expect(updated.role).toBe(Role.HOTEL_MANAGER);
      expect(updated.active).toBe(false);
      expect(updated.uiLang).toBe('fr');

      const call = fakePrisma.updateCalls[0];
      expect(call?.data).toEqual({
        name: 'Youssef Modifié',
        role: PrismaRole.HOTEL_MANAGER,
        active: false,
        uiLang: 'fr',
      });
    });

    it('lève NotFoundException si l’utilisateur est introuvable (404)', async () => {
      await expect(
        service.update(USER_ID_1, UNKNOWN_USER_ID, { name: 'Inconnu' }),
      ).rejects.toThrow(NotFoundException);

      expect(fakePrisma.updateCalls).toHaveLength(0);
    });

    it('lève ForbiddenException lors d’une tentative d’auto-désactivation (actorId === id, active: false)', async () => {
      await expect(
        service.update(USER_ID_1, USER_ID_1, { active: false }),
      ).rejects.toThrow(ForbiddenException);

      expect(fakePrisma.updateCalls).toHaveLength(0);
    });

    it('lève ForbiddenException lors d’une tentative d’auto-changement de rôle (actorId === id, role modifié)', async () => {
      await expect(
        service.update(USER_ID_1, USER_ID_1, { role: Role.EDITOR }),
      ).rejects.toThrow(ForbiddenException);

      expect(fakePrisma.updateCalls).toHaveLength(0);
    });

    it('autorise un utilisateur à modifier son propre nom ou uiLang sans modifier son rôle', async () => {
      const updated = await service.update(USER_ID_1, USER_ID_1, {
        name: 'Sara Nouvelle',
        uiLang: 'en',
      });

      expect(updated.id).toBe(USER_ID_1);
      expect(updated.name).toBe('Sara Nouvelle');
      expect(updated.uiLang).toBe('en');
      expect(updated.role).toBe(Role.ADMIN);
      expect(updated.active).toBe(true);

      expect(fakePrisma.updateCalls).toHaveLength(1);
    });

    it('autorise un utilisateur à fournir son propre rôle s’il est identique au rôle actuel', async () => {
      const updated = await service.update(USER_ID_1, USER_ID_1, {
        role: Role.ADMIN,
        name: 'Sara Idrissi',
      });

      expect(updated.id).toBe(USER_ID_1);
      expect(updated.role).toBe(Role.ADMIN);
      expect(fakePrisma.updateCalls).toHaveLength(1);
    });

    it('lève ConflictException lors d’une tentative de désactivation du dernier ADMIN actif', async () => {
      // USER_ID_1 est l'unique ADMIN actif dans sampleRecords. USER_ID_2 (un autre acteur) tente de le désactiver.
      await expect(
        service.update(USER_ID_2, USER_ID_1, { active: false }),
      ).rejects.toThrow(ConflictException);

      expect(fakePrisma.updateCalls).toHaveLength(0);
    });

    it('lève ConflictException lors d’une tentative de rétrogradation du dernier ADMIN actif', async () => {
      // USER_ID_1 est l'unique ADMIN actif dans sampleRecords. USER_ID_2 tente de le rétrograder en EDITOR.
      await expect(
        service.update(USER_ID_2, USER_ID_1, { role: Role.EDITOR }),
      ).rejects.toThrow(ConflictException);

      expect(fakePrisma.updateCalls).toHaveLength(0);
    });

    it('autorise la désactivation d’un administrateur lorsqu’il existe au moins 2 ADMIN actifs', async () => {
      const secondAdmin: FakeUserRecord = {
        id: '01990000-0000-7000-8000-000000000006',
        email: 'admin2@xplor.local',
        name: 'Second Admin',
        passwordHash: '$2b$12$secretPasswordHashAdmin2',
        totpSecret: null,
        role: PrismaRole.ADMIN,
        active: true,
        totpEnabled: false,
        lastLoginAt: null,
        uiLang: 'fr',
        createdAt: new Date('2026-11-06T12:00:00.000Z'),
        hotels: [],
      };
      fakePrisma.records.push(secondAdmin);

      const updated = await service.update(USER_ID_1, secondAdmin.id, {
        active: false,
      });

      expect(updated.id).toBe(secondAdmin.id);
      expect(updated.active).toBe(false);
      expect(fakePrisma.updateCalls).toHaveLength(1);
    });

    it('autorise la rétrogradation d’un administrateur lorsqu’il existe au moins 2 ADMIN actifs', async () => {
      const secondAdmin: FakeUserRecord = {
        id: '01990000-0000-7000-8000-000000000006',
        email: 'admin2@xplor.local',
        name: 'Second Admin',
        passwordHash: '$2b$12$secretPasswordHashAdmin2',
        totpSecret: null,
        role: PrismaRole.ADMIN,
        active: true,
        totpEnabled: false,
        lastLoginAt: null,
        uiLang: 'fr',
        createdAt: new Date('2026-11-06T12:00:00.000Z'),
        hotels: [],
      };
      fakePrisma.records.push(secondAdmin);

      const updated = await service.update(USER_ID_1, secondAdmin.id, {
        role: Role.HOTEL_MANAGER,
      });

      expect(updated.id).toBe(secondAdmin.id);
      expect(updated.role).toBe(Role.HOTEL_MANAGER);
      expect(fakePrisma.updateCalls).toHaveLength(1);
    });

    it('ne lève pas ConflictException pour la désactivation d’un utilisateur non-admin', async () => {
      // USER_ID_2 est HOTEL_MANAGER
      const updated = await service.update(USER_ID_1, USER_ID_2, { active: false });
      expect(updated.id).toBe(USER_ID_2);
      expect(updated.active).toBe(false);
    });

    it('lève BadRequestException si le payload de mise à jour est invalide', async () => {
      // Payload vide (UpdateAdminUserRequestSchema exige au moins un champ)
      await expect(service.update(USER_ID_1, USER_ID_2, {})).rejects.toThrow(
        BadRequestException,
      );
      // Nom vide
      await expect(service.update(USER_ID_1, USER_ID_2, { name: '' })).rejects.toThrow(
        BadRequestException,
      );
      // Rôle invalide
      await expect(
        service.update(USER_ID_1, USER_ID_2, { role: 'SUPER_ADMIN' }),
      ).rejects.toThrow(BadRequestException);
      // Langue invalide
      await expect(service.update(USER_ID_1, USER_ID_2, { uiLang: 'de' })).rejects.toThrow(
        BadRequestException,
      );
    });

    describe('audit de changement de rôle (F-91, API-28)', () => {
      it('enregistre user.role_change avec les bons champs lorsque le rôle change', async () => {
        const recordMock = vi.fn<AuditRecorder['record']>().mockResolvedValue(undefined);
        const fakeAudit: AuditRecorder = { record: recordMock };
        const serviceWithAudit = new UsersAdminService(fakePrisma, fakeAudit);

        // USER_ID_2 est initialement HOTEL_MANAGER, USER_ID_1 est l'administrateur appelant
        const updated = await serviceWithAudit.update(USER_ID_1, USER_ID_2, {
          role: Role.ADMIN,
        });

        expect(updated.id).toBe(USER_ID_2);
        expect(updated.role).toBe(Role.ADMIN);

        expect(recordMock).toHaveBeenCalledTimes(1);
        expect(recordMock).toHaveBeenCalledWith({
          action: 'user.role_change',
          entityType: 'User',
          entityId: USER_ID_2,
          userId: USER_ID_1,
          diff: {
            from: Role.HOTEL_MANAGER,
            to: Role.ADMIN,
          },
        });

        const call = recordMock.mock.calls[0];
        expect(call).toBeDefined();
        if (call !== undefined) {
          const diff = call[0].diff;
          if (typeof diff === 'object' && diff !== null) {
            expect(Object.keys(diff).sort()).toEqual(['from', 'to'].sort());
          }
        }
      });

      it('n’inclut que les rôles dans diff même si d’autres champs sont modifiés simultanément', async () => {
        const recordMock = vi.fn<AuditRecorder['record']>().mockResolvedValue(undefined);
        const fakeAudit: AuditRecorder = { record: recordMock };
        const serviceWithAudit = new UsersAdminService(fakePrisma, fakeAudit);

        // USER_ID_4 est initialement EDITOR
        const updated = await serviceWithAudit.update(USER_ID_1, USER_ID_4, {
          role: Role.HOTEL_MANAGER,
          name: 'Youssef El Amrani Modifié',
          uiLang: 'fr',
          active: true,
        });

        expect(updated.id).toBe(USER_ID_4);
        expect(updated.role).toBe(Role.HOTEL_MANAGER);
        expect(updated.name).toBe('Youssef El Amrani Modifié');

        expect(recordMock).toHaveBeenCalledTimes(1);
        expect(recordMock).toHaveBeenCalledWith({
          action: 'user.role_change',
          entityType: 'User',
          entityId: USER_ID_4,
          userId: USER_ID_1,
          diff: {
            from: Role.EDITOR,
            to: Role.HOTEL_MANAGER,
          },
        });

        const call = recordMock.mock.calls[0];
        expect(call).toBeDefined();
        if (call !== undefined) {
          const diff = call[0].diff;
          if (typeof diff === 'object' && diff !== null) {
            expect(Object.keys(diff).sort()).toEqual(['from', 'to'].sort());
            expect(diff).toEqual({
              from: Role.EDITOR,
              to: Role.HOTEL_MANAGER,
            });
          }
        }
      });

      it('n’appelle pas l’audit si le rôle est inchangé lors de la mise à jour d’autres champs', async () => {
        const recordMock = vi.fn<AuditRecorder['record']>().mockResolvedValue(undefined);
        const fakeAudit: AuditRecorder = { record: recordMock };
        const serviceWithAudit = new UsersAdminService(fakePrisma, fakeAudit);

        await serviceWithAudit.update(USER_ID_1, USER_ID_2, {
          name: 'Karim Sans Changement De Rôle',
          active: false,
        });

        expect(recordMock).not.toHaveBeenCalled();
      });

      it('n’appelle pas l’audit si le rôle fourni est identique au rôle actuel', async () => {
        const recordMock = vi.fn<AuditRecorder['record']>().mockResolvedValue(undefined);
        const fakeAudit: AuditRecorder = { record: recordMock };
        const serviceWithAudit = new UsersAdminService(fakePrisma, fakeAudit);

        // USER_ID_2 est déjà HOTEL_MANAGER
        await serviceWithAudit.update(USER_ID_1, USER_ID_2, {
          role: Role.HOTEL_MANAGER,
          name: 'Karim Identique',
        });

        expect(recordMock).not.toHaveBeenCalled();
      });

      it('ne fait pas échouer update si audit.record rejette une erreur', async () => {
        const recordMock = vi
          .fn<AuditRecorder['record']>()
          .mockRejectedValue(new Error('Audit DB unreachable'));
        const fakeAudit: AuditRecorder = { record: recordMock };
        const serviceWithAudit = new UsersAdminService(fakePrisma, fakeAudit);

        const updated = await serviceWithAudit.update(USER_ID_1, USER_ID_2, {
          role: Role.ADMIN,
        });

        expect(updated.id).toBe(USER_ID_2);
        expect(updated.role).toBe(Role.ADMIN);
        expect(recordMock).toHaveBeenCalledTimes(1);

        const dbRecord = fakePrisma.records.find((r) => r.id === USER_ID_2);
        expect(dbRecord?.role).toBe(PrismaRole.ADMIN);
      });

      it('ne fait pas échouer update si audit.record lève une exception synchrone', async () => {
        const recordMock = vi.fn<AuditRecorder['record']>().mockImplementation(() => {
          throw new Error('Sync audit failure');
        });
        const fakeAudit: AuditRecorder = { record: recordMock };
        const serviceWithAudit = new UsersAdminService(fakePrisma, fakeAudit);

        const updated = await serviceWithAudit.update(USER_ID_1, USER_ID_2, {
          role: Role.ADMIN,
        });

        expect(updated.id).toBe(USER_ID_2);
        expect(updated.role).toBe(Role.ADMIN);
        expect(recordMock).toHaveBeenCalledTimes(1);
      });

      it('n’appelle pas l’audit si la validation ou l’autorisation échoue', async () => {
        const recordMock = vi.fn<AuditRecorder['record']>().mockResolvedValue(undefined);
        const fakeAudit: AuditRecorder = { record: recordMock };
        const serviceWithAudit = new UsersAdminService(fakePrisma, fakeAudit);

        // Tentative d'auto-modification de rôle -> 403 ForbiddenException
        await expect(
          serviceWithAudit.update(USER_ID_1, USER_ID_1, { role: Role.EDITOR }),
        ).rejects.toThrow(ForbiddenException);

        // Tentative de rétrogradation du dernier administrateur actif -> 409 ConflictException
        await expect(
          serviceWithAudit.update(USER_ID_2, USER_ID_1, { role: Role.EDITOR }),
        ).rejects.toThrow(ConflictException);

        // Payload invalide -> 400 BadRequestException
        await expect(
          serviceWithAudit.update(USER_ID_1, USER_ID_2, { role: 'INVALIDE' }),
        ).rejects.toThrow(BadRequestException);

        expect(recordMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('absence formelle des champs secrets', () => {
    it('exclut formellement passwordHash et totpSecret de la sélection Prisma', () => {
      expect(USER_ADMIN_SELECT).not.toHaveProperty('passwordHash');
      expect(USER_ADMIN_SELECT).not.toHaveProperty('totpSecret');
      expect(USER_ADMIN_SELECT).not.toHaveProperty('failedLoginCount');
      expect(USER_ADMIN_SELECT).not.toHaveProperty('lockedUntil');
    });

    it('garantit que les objets retournés par list n’exposent aucun secret', async () => {
      const response = await service.list();

      for (const item of response.items) {
        expect(item).not.toHaveProperty('passwordHash');
        expect(item).not.toHaveProperty('totpSecret');
        expect(item).not.toHaveProperty('failedLoginCount');
        expect(item).not.toHaveProperty('lockedUntil');
      }
    });

    it('garantit que l’objet retourné par get n’expose aucun secret', async () => {
      const user = await service.get(USER_ID_1);

      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('totpSecret');
      expect(user).not.toHaveProperty('failedLoginCount');
      expect(user).not.toHaveProperty('lockedUntil');
    });

    it('garantit que l’objet retourné par update n’expose aucun secret', async () => {
      const user = await service.update(USER_ID_1, USER_ID_2, {
        name: 'Karim Sans Secrets',
      });

      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('totpSecret');
      expect(user).not.toHaveProperty('failedLoginCount');
      expect(user).not.toHaveProperty('lockedUntil');
    });
  });

  describe('buildUserAdminWhereInput', () => {
    it('construit un objet vide sans filtres', () => {
      const where = buildUserAdminWhereInput({ page: 1, pageSize: 20 });
      expect(where).toEqual({});
    });

    it('ignore q si la chaîne est vide ou ne contient que des espaces', () => {
      const where = buildUserAdminWhereInput({ page: 1, pageSize: 20, q: '' });
      expect(where).toEqual({});
    });
  });

  describe('toAdminUser', () => {
    it('convertit un objet UserAdminRow avec lastLoginAt sous forme de chaîne ISO', () => {
      const adminUser = toAdminUser({
        id: USER_ID_4,
        email: 'youssef@xplor.local',
        name: 'Youssef El Amrani',
        role: PrismaRole.EDITOR,
        active: true,
        totpEnabled: false,
        lastLoginAt: '2026-11-06T15:30:00.000Z',
        uiLang: 'en',
        hotels: [],
      });

      expect(adminUser.lastLoginAt).toBe('2026-11-06T15:30:00.000Z');
      expect(adminUser.role).toBe(Role.EDITOR);
      expect(adminUser.uiLang).toBe('en');
    });
  });
});
