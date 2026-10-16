import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, z, type Principal } from '@xplor/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  HotelManagersService,
  type HotelManagersPrismaClient,
  type HotelManagersTransactionClient,
  type HotelSummaryRow,
  type UserHotelRow,
  type UserSummaryRow,
} from './hotel-managers.service.js';
import {
  USER_INVALID,
  USER_INVALID_MESSAGE,
  USER_NOT_FOUND,
  USER_NOT_FOUND_MESSAGE,
} from './hotels.errors.js';

const HOTEL_A_ID = '01990000-0000-7000-8000-000000000101';
const HOTEL_B_ID = '01990000-0000-7000-8000-000000000102';
const HOTEL_DELETED_ID = '01990000-0000-7000-8000-000000000103';
const UNKNOWN_HOTEL_ID = '01990000-0000-7000-8000-000000000199';

const ADMIN_ID = '01990000-0000-7000-8000-000000000201';
const MANAGER_A_ID = '01990000-0000-7000-8000-000000000202';
const MANAGER_B_ID = '01990000-0000-7000-8000-000000000203';
const MANAGER_C_ID = '01990000-0000-7000-8000-000000000204';
const INACTIVE_MANAGER_ID = '01990000-0000-7000-8000-000000000205';
const EDITOR_ID = '01990000-0000-7000-8000-000000000206';
const UNKNOWN_USER_ID = '01990000-0000-7000-8000-000000000299';

const admin: Principal = {
  userId: ADMIN_ID,
  role: Role.ADMIN,
  hotelIds: [],
};

const managerHotelA: Principal = {
  userId: MANAGER_A_ID,
  role: Role.HOTEL_MANAGER,
  hotelIds: [HOTEL_A_ID],
};

interface UserHotelLink {
  hotelId: string;
  userId: string;
}

const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

function harness(): {
  service: HotelManagersService;
  hotels: Map<string, HotelSummaryRow>;
  users: Map<string, UserSummaryRow>;
  userHotels: UserHotelLink[];
  deleteManyMock: ReturnType<
    typeof vi.fn<(args?: { where?: Prisma.UserHotelWhereInput }) => Promise<Prisma.BatchPayload>>
  >;
  createManyMock: ReturnType<
    typeof vi.fn<(args: { data: Prisma.UserHotelCreateManyInput[] }) => Promise<Prisma.BatchPayload>>
  >;
} {
  const hotels = new Map<string, HotelSummaryRow>([
    [HOTEL_A_ID, { id: HOTEL_A_ID, deletedAt: null }],
    [HOTEL_B_ID, { id: HOTEL_B_ID, deletedAt: null }],
    [HOTEL_DELETED_ID, { id: HOTEL_DELETED_ID, deletedAt: new Date('2026-10-01T00:00:00.000Z') }],
  ]);

  const users = new Map<string, UserSummaryRow>([
    [
      MANAGER_A_ID,
      {
        id: MANAGER_A_ID,
        email: 'karim@xplor.local',
        name: 'Bennani Karim',
        active: true,
        role: Role.HOTEL_MANAGER,
      },
    ],
    [
      MANAGER_B_ID,
      {
        id: MANAGER_B_ID,
        email: 'sara@xplor.local',
        name: 'Alami Sara',
        active: true,
        role: Role.HOTEL_MANAGER,
      },
    ],
    [
      MANAGER_C_ID,
      {
        id: MANAGER_C_ID,
        email: 'zineb@xplor.local',
        name: 'Chraibi Zineb',
        active: true,
        role: Role.HOTEL_MANAGER,
      },
    ],
    [
      INACTIVE_MANAGER_ID,
      {
        id: INACTIVE_MANAGER_ID,
        email: 'inactif@xplor.local',
        name: 'Inactif Mohamed',
        active: false,
        role: Role.HOTEL_MANAGER,
      },
    ],
    [
      EDITOR_ID,
      {
        id: EDITOR_ID,
        email: 'editeur@xplor.local',
        name: 'Editeur Youssef',
        active: true,
        role: Role.EDITOR,
      },
    ],
  ]);

  const userHotels: UserHotelLink[] = [
    { hotelId: HOTEL_A_ID, userId: MANAGER_A_ID },
    { hotelId: HOTEL_A_ID, userId: MANAGER_B_ID },
    { hotelId: HOTEL_B_ID, userId: MANAGER_C_ID },
  ];

  const deleteManyMock = vi.fn(
    (args?: { where?: Prisma.UserHotelWhereInput }): Promise<Prisma.BatchPayload> => {
      const hotelId = args?.where?.hotelId;
      let count = 0;
      for (let i = userHotels.length - 1; i >= 0; i--) {
        const item = userHotels[i];
        if (item !== undefined && (typeof hotelId !== 'string' || item.hotelId === hotelId)) {
          userHotels.splice(i, 1);
          count++;
        }
      }
      return Promise.resolve({ count });
    },
  );

  const createManyMock = vi.fn(
    (args: { data: Prisma.UserHotelCreateManyInput[] }): Promise<Prisma.BatchPayload> => {
      for (const entry of args.data) {
        userHotels.push({
          hotelId: entry.hotelId,
          userId: entry.userId,
        });
      }
      return Promise.resolve({ count: args.data.length });
    },
  );

  const prisma: HotelManagersPrismaClient = {
    hotel: {
      findFirst: (args: { where: Prisma.HotelWhereInput }): Promise<HotelSummaryRow | null> => {
        let result = [...hotels.values()];
        if (typeof args.where.id === 'string') {
          result = result.filter((h) => h.id === args.where.id);
        }
        if (args.where.deletedAt === null) {
          result = result.filter((h) => h.deletedAt === null);
        }
        return Promise.resolve(result[0] ?? null);
      },
    },

    user: {
      findMany: (args?: {
        where?: Prisma.UserWhereInput;
        select?: Prisma.UserSelect;
      }): Promise<UserSummaryRow[]> => {
        let result = [...users.values()];
        const idFilter = args?.where?.id;
        if (typeof idFilter === 'object' && 'in' in idFilter) {
          const allowed = idFilter.in;
          if (Array.isArray(allowed)) {
            result = result.filter((u) => allowed.includes(u.id));
          }
        }
        return Promise.resolve(result);
      },
    },

    userHotel: {
      findMany: (args?: {
        where?: Prisma.UserHotelWhereInput;
        select?: Prisma.UserHotelSelect;
      }): Promise<UserHotelRow[]> => {
        const hotelId = args?.where?.hotelId;
        const filteredLinks = userHotels.filter((link) => {
          if (typeof hotelId === 'string') {
            return link.hotelId === hotelId;
          }
          return true;
        });

        const rows: UserHotelRow[] = [];
        for (const link of filteredLinks) {
          const user = users.get(link.userId);
          if (user !== undefined) {
            rows.push({
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
              },
            });
          }
        }
        return Promise.resolve(rows);
      },

      deleteMany: deleteManyMock,
      createMany: createManyMock,
    },

    $transaction: <T>(fn: (tx: HotelManagersTransactionClient) => Promise<T>): Promise<T> => {
      return fn({
        userHotel: {
          deleteMany: deleteManyMock,
          createMany: createManyMock,
        },
      });
    },
  };

  return {
    service: new HotelManagersService(prisma),
    hotels,
    users,
    userHotels,
    deleteManyMock,
    createManyMock,
  };
}

async function readReferenceError(
  pending: Promise<unknown>,
): Promise<{ code: string; message: string }> {
  try {
    await pending;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(HttpException);
    if (error instanceof HttpException) {
      expect(error.getStatus()).toBe(422);
      const parsed = ErrorResponseSchema.parse(error.getResponse());
      return parsed.error;
    }
    throw error;
  }
  throw new Error('Erreur 422 attendue mais non levée');
}

describe('HotelManagersService', () => {
  it('un gestionnaire de l’hôtel A reçoit 404 sur list de l’hôtel B', async () => {
    const { service } = harness();
    await expect(service.list(managerHotelA, HOTEL_B_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const ownList = await service.list(managerHotelA, HOTEL_A_ID);
    expect(ownList).toHaveLength(2);
  });

  it('ADMIN liste tout (tri par nom)', async () => {
    const { service } = harness();

    const listA = await service.list(admin, HOTEL_A_ID);
    expect(listA).toHaveLength(2);
    expect(listA.map((m) => m.name)).toEqual(['Alami Sara', 'Bennani Karim']);

    const listB = await service.list(admin, HOTEL_B_ID);
    expect(listB).toHaveLength(1);
    const firstB = listB[0];
    expect(firstB).toBeDefined();
    if (firstB !== undefined) {
      expect(firstB.id).toBe(MANAGER_C_ID);
      expect(firstB.name).toBe('Chraibi Zineb');
      expect(firstB.email).toBe('zineb@xplor.local');
    }
  });

  it('replace avec un utilisateur de rôle EDITOR → 422', async () => {
    const { service } = harness();
    const error = await readReferenceError(service.replace(HOTEL_A_ID, [EDITOR_ID]));
    expect(error.code).toBe(USER_INVALID);
    expect(error.message).toBe(USER_INVALID_MESSAGE);
  });

  it('replace avec un utilisateur inconnu → 422', async () => {
    const { service } = harness();
    const error = await readReferenceError(
      service.replace(HOTEL_A_ID, [UNKNOWN_USER_ID]),
    );
    expect(error.code).toBe(USER_NOT_FOUND);
    expect(error.message).toBe(USER_NOT_FOUND_MESSAGE);
  });

  it('replace avec un utilisateur inactif → 422', async () => {
    const { service } = harness();
    const error = await readReferenceError(
      service.replace(HOTEL_A_ID, [INACTIVE_MANAGER_ID]),
    );
    expect(error.code).toBe(USER_INVALID);
    expect(error.message).toBe(USER_INVALID_MESSAGE);
  });

  it('replace sur un hôtel supprimé → 404', async () => {
    const { service } = harness();
    await expect(
      service.replace(HOTEL_DELETED_ID, [MANAGER_A_ID]),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.replace(UNKNOWN_HOTEL_ID, [MANAGER_A_ID]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replace([]) appelle deleteMany sans createMany et renvoie []', async () => {
    const { service, deleteManyMock, createManyMock } = harness();

    const cleared = await service.replace(HOTEL_A_ID, []);

    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { hotelId: HOTEL_A_ID } });
    expect(createManyMock).not.toHaveBeenCalled();
    expect(cleared).toEqual([]);

    const afterList = await service.list(admin, HOTEL_A_ID);
    expect(afterList).toEqual([]);
  });

  it('replace met à jour les rattachements et renvoie la nouvelle liste triée par nom', async () => {
    const { service, deleteManyMock, createManyMock } = harness();

    const updated = await service.replace(HOTEL_A_ID, [MANAGER_C_ID, MANAGER_A_ID]);

    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    expect(createManyMock).toHaveBeenCalledTimes(1);
    expect(updated).toHaveLength(2);
    expect(updated.map((m) => m.name)).toEqual(['Bennani Karim', 'Chraibi Zineb']);

    const list = await service.list(admin, HOTEL_A_ID);
    expect(list.map((m) => m.id)).toEqual([MANAGER_A_ID, MANAGER_C_ID]);
  });
});
