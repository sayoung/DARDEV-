import { Test, TestingModule } from '@nestjs/testing';
import { ContractType, HotelStars, Role } from '@prisma/client';
import { AdminUserSchema, AuditLogEntrySchema } from '@xplor/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditService } from '../src/audit/audit.service.js';
import { InMemorySessionStore } from '../src/auth/in-memory-session.store.js';
import { SESSION_STORE } from '../src/auth/session-store.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UsersAdminService } from '../src/users/users-admin.service.js';
import { readDatabaseUrlTest } from './global-setup.js';

const databaseUrl = readDatabaseUrlTest();
const savedDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaService({
  datasourceUrl: databaseUrl,
  errorFormat: 'minimal',
});
const auditService = new AuditService(prisma);
const sessionStore = new InMemorySessionStore();

let moduleRef: TestingModule;
let usersAdminService: UsersAdminService;

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({
    providers: [
      UsersAdminService,
      { provide: PrismaService, useValue: prisma },
      { provide: SESSION_STORE, useValue: sessionStore },
      { provide: AuditService, useValue: auditService },
    ],
  }).compile();

  usersAdminService = moduleRef.get(UsersAdminService);
});

const createdAuditLogIds: string[] = [];
const createdUserIds: string[] = [];
const createdHotelIds: string[] = [];
const createdCityIds: string[] = [];

afterAll(async () => {
  try {
    if (createdAuditLogIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { id: { in: createdAuditLogIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityType: 'User', entityId: { in: createdUserIds } },
            { userId: { in: createdUserIds } },
          ],
        },
      });
      await prisma.userHotel.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    if (createdHotelIds.length > 0) {
      await prisma.userHotel.deleteMany({
        where: { hotelId: { in: createdHotelIds } },
      });
      await prisma.hotel.deleteMany({
        where: { id: { in: createdHotelIds } },
      });
    }
    if (createdCityIds.length > 0) {
      await prisma.city.deleteMany({
        where: { id: { in: createdCityIds } },
      });
    }
  } finally {
    await prisma.$disconnect();
    await moduleRef.close();
    if (savedDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = savedDatabaseUrl;
    }
  }
});

async function createTestUser(role: Role, name: string): Promise<string> {
  const timestamp = `${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      email: `user-admin-${timestamp}@xplor.local`,
      name,
      passwordHash: 'dummyhash-users-admin',
      role,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function createTestHotel(): Promise<string> {
  const timestamp = `${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`;
  const city = await prisma.city.create({
    data: {
      name: {
        fr: `Ville Test ${timestamp}`,
        ar: `مدينة ${timestamp}`,
        en: `City ${timestamp}`,
      },
      region: 'Rabat-Salé-Kénitra',
      lat: 34.020882,
      lng: -6.84165,
    },
  });
  createdCityIds.push(city.id);

  const hotel = await prisma.hotel.create({
    data: {
      name: `Hôtel Test ${timestamp}`,
      stars: HotelStars.FIVE,
      cityId: city.id,
      address: '1 rue de Test, Rabat',
      phone: '+212500000000',
      email: `hotel-${timestamp}@xplor.local`,
      brandColor: '#6958A5',
      contractType: ContractType.RENTAL,
      contractStart: new Date('2026-01-01T00:00:00.000Z'),
      contractEnd: new Date('2027-01-01T00:00:00.000Z'),
    },
  });
  createdHotelIds.push(hotel.id);
  return hotel.id;
}

describe('UsersAdminService — test d’intégration (API-28)', () => {
  it('crée un utilisateur et un hôtel, associe l’hôtel via setHotels puis get renvoie les hotelIds attendus, et update du rôle écrit une ligne AuditLog user.role_change', async () => {
    const adminUserId = await createTestUser(Role.ADMIN, 'Administrateur Principal');
    const targetUserId = await createTestUser(Role.HOTEL_MANAGER, 'Gestionnaire Test');
    const hotelId = await createTestHotel();

    const initialUser = await usersAdminService.get(targetUserId);
    expect(AdminUserSchema.parse(initialUser).hotelIds).toEqual([]);

    const setHotelsResult = await usersAdminService.setHotels(targetUserId, [hotelId]);
    expect(AdminUserSchema.parse(setHotelsResult).hotelIds).toEqual([hotelId]);

    const fetchedUser = await usersAdminService.get(targetUserId);
    const parsedFetched = AdminUserSchema.parse(fetchedUser);
    expect(parsedFetched.id).toBe(targetUserId);
    expect(parsedFetched.role).toBe(Role.HOTEL_MANAGER);
    expect(parsedFetched.hotelIds).toEqual([hotelId]);

    const updateResult = await usersAdminService.update(adminUserId, targetUserId, {
      role: Role.EDITOR,
    });
    expect(AdminUserSchema.parse(updateResult).role).toBe(Role.EDITOR);

    const afterUpdateUser = await usersAdminService.get(targetUserId);
    expect(AdminUserSchema.parse(afterUpdateUser).role).toBe(Role.EDITOR);

    const roleChangeAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'user.role_change',
        entityType: 'User',
        entityId: targetUserId,
      },
    });

    expect(roleChangeAudit).not.toBeNull();
    if (roleChangeAudit === null) {
      throw new Error('AuditLog user.role_change non trouvé en base');
    }
    createdAuditLogIds.push(roleChangeAudit.id);

    const parsedEntry = AuditLogEntrySchema.parse({
      id: roleChangeAudit.id,
      userId: roleChangeAudit.userId,
      kioskId: roleChangeAudit.kioskId,
      action: roleChangeAudit.action,
      entityType: roleChangeAudit.entityType,
      entityId: roleChangeAudit.entityId,
      diff: roleChangeAudit.diff,
      ip: roleChangeAudit.ip,
      createdAt: roleChangeAudit.createdAt.toISOString(),
    });

    expect(parsedEntry.action).toBe('user.role_change');
    expect(parsedEntry.entityType).toBe('User');
    expect(parsedEntry.entityId).toBe(targetUserId);
    expect(parsedEntry.userId).toBe(adminUserId);
    expect(parsedEntry.diff).toEqual({
      from: 'HOTEL_MANAGER',
      to: 'EDITOR',
    });
  });
});
