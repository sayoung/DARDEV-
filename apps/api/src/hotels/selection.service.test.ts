import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, SelectionResponseSchema, type Principal } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import {
  SelectionService,
  type HotelSummaryRow,
  type SelectionPrismaClient,
  type SelectionRow,
} from './selection.service.js';

const HOTEL_A_ID = '01990000-0000-7000-8000-000000000101';
const HOTEL_B_ID = '01990000-0000-7000-8000-000000000102';
const HOTEL_EMPTY_ID = '01990000-0000-7000-8000-000000000103';
const HOTEL_DELETED_ID = '01990000-0000-7000-8000-000000000104';
const UNKNOWN_HOTEL_ID = '01990000-0000-7000-8000-000000000199';

const TOUR_1_ID = '01990000-0000-7000-8000-000000000301';
const TOUR_2_ID = '01990000-0000-7000-8000-000000000302';
const TOUR_3_ID = '01990000-0000-7000-8000-000000000303';
const TOUR_4_ID = '01990000-0000-7000-8000-000000000304';

const ADMIN_ID = '01990000-0000-7000-8000-000000000201';
const MANAGER_A_ID = '01990000-0000-7000-8000-000000000202';
const MANAGER_B_ID = '01990000-0000-7000-8000-000000000203';
const EDITOR_ID = '01990000-0000-7000-8000-000000000204';

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

const managerHotelB: Principal = {
  userId: MANAGER_B_ID,
  role: Role.HOTEL_MANAGER,
  hotelIds: [HOTEL_B_ID],
};

const editor: Principal = {
  userId: EDITOR_ID,
  role: Role.EDITOR,
  hotelIds: [],
};

const HOTEL_A_CREATED_AT = new Date('2026-10-01T10:00:00.000Z');
const HOTEL_B_CREATED_AT = new Date('2026-10-02T11:00:00.000Z');
const HOTEL_EMPTY_CREATED_AT = new Date('2026-10-03T12:00:00.000Z');
const HOTEL_DELETED_CREATED_AT = new Date('2026-10-04T13:00:00.000Z');
const HOTEL_DELETED_AT = new Date('2026-10-05T14:00:00.000Z');

const SELECTION_A_CREATED_AT = new Date('2026-10-01T10:30:00.000Z');
const SELECTION_A_UPDATED_AT = new Date('2026-10-01T15:45:00.000Z');

const SELECTION_B_CREATED_AT = new Date('2026-10-02T11:30:00.000Z');
const SELECTION_B_UPDATED_AT = new Date('2026-10-02T16:20:00.000Z');

function harness(): {
  service: SelectionService;
  hotels: Map<string, HotelSummaryRow>;
  selections: Map<string, SelectionRow>;
} {
  const hotels = new Map<string, HotelSummaryRow>([
    [HOTEL_A_ID, { id: HOTEL_A_ID, createdAt: HOTEL_A_CREATED_AT, deletedAt: null }],
    [HOTEL_B_ID, { id: HOTEL_B_ID, createdAt: HOTEL_B_CREATED_AT, deletedAt: null }],
    [HOTEL_EMPTY_ID, { id: HOTEL_EMPTY_ID, createdAt: HOTEL_EMPTY_CREATED_AT, deletedAt: null }],
    [
      HOTEL_DELETED_ID,
      { id: HOTEL_DELETED_ID, createdAt: HOTEL_DELETED_CREATED_AT, deletedAt: HOTEL_DELETED_AT },
    ],
  ]);

  const selections = new Map<string, SelectionRow>([
    [
      HOTEL_A_ID,
      {
        id: '01990000-0000-7000-8000-000000000401',
        hotelId: HOTEL_A_ID,
        featuredTourId: TOUR_1_ID,
        attractTourIds: [TOUR_1_ID, TOUR_2_ID],
        version: 3,
        createdAt: SELECTION_A_CREATED_AT,
        updatedAt: SELECTION_A_UPDATED_AT,
        items: [
          { tourId: TOUR_3_ID, position: 2 },
          { tourId: TOUR_1_ID, position: 0 },
          { tourId: TOUR_2_ID, position: 1 },
        ],
      },
    ],
    [
      HOTEL_B_ID,
      {
        id: '01990000-0000-7000-8000-000000000402',
        hotelId: HOTEL_B_ID,
        featuredTourId: TOUR_4_ID,
        attractTourIds: [TOUR_4_ID],
        version: 5,
        createdAt: SELECTION_B_CREATED_AT,
        updatedAt: SELECTION_B_UPDATED_AT,
        items: [{ tourId: TOUR_4_ID, position: 0 }],
      },
    ],
  ]);

  const prisma: SelectionPrismaClient = {
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

    selection: {
      findUnique: (args: {
        where: Prisma.SelectionWhereUniqueInput;
        include?: Prisma.SelectionInclude;
      }): Promise<SelectionRow | null> => {
        const hotelId = args.where.hotelId;
        if (typeof hotelId !== 'string') {
          return Promise.resolve(null);
        }
        const row = selections.get(hotelId);
        if (row === undefined) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: row.id,
          hotelId: row.hotelId,
          featuredTourId: row.featuredTourId,
          attractTourIds: [...row.attractTourIds],
          version: row.version,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          items: row.items.map((it) => ({
            tourId: it.tourId,
            position: it.position,
          })),
        });
      },
    },
  };

  return {
    service: new SelectionService(prisma),
    hotels,
    selections,
  };
}

describe('SelectionService', () => {
  it('un gestionnaire de l’hôtel A reçoit 404 sur get de l’hôtel B', async () => {
    const { service } = harness();

    await expect(service.get(managerHotelA, HOTEL_B_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const ownSelection = await service.get(managerHotelA, HOTEL_A_ID);
    expect(ownSelection.hotelId).toBe(HOTEL_A_ID);
    expect(ownSelection.version).toBe(3);

    const managerBSelection = await service.get(managerHotelB, HOTEL_B_ID);
    expect(managerBSelection.hotelId).toBe(HOTEL_B_ID);
    expect(managerBSelection.version).toBe(5);
  });

  it('ADMIN lit toutes les sélections', async () => {
    const { service } = harness();

    const selectionA = await service.get(admin, HOTEL_A_ID);
    expect(selectionA.hotelId).toBe(HOTEL_A_ID);
    expect(selectionA.version).toBe(3);
    expect(selectionA.featuredTourId).toBe(TOUR_1_ID);
    expect(selectionA.attractTourIds).toEqual([TOUR_1_ID, TOUR_2_ID]);
    expect(selectionA.items).toHaveLength(3);
    expect(SelectionResponseSchema.parse(selectionA)).toEqual(selectionA);

    const selectionB = await service.get(admin, HOTEL_B_ID);
    expect(selectionB.hotelId).toBe(HOTEL_B_ID);
    expect(selectionB.version).toBe(5);
    expect(selectionB.featuredTourId).toBe(TOUR_4_ID);
    expect(selectionB.attractTourIds).toEqual([TOUR_4_ID]);
    expect(selectionB.items).toHaveLength(1);
    expect(SelectionResponseSchema.parse(selectionB)).toEqual(selectionB);
  });

  it('hôtel supprimé → 404', async () => {
    const { service } = harness();

    await expect(service.get(admin, HOTEL_DELETED_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    await expect(service.get(admin, UNKNOWN_HOTEL_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sélection absente → réponse vide avec version 1', async () => {
    const { service } = harness();

    const emptySelection = await service.get(admin, HOTEL_EMPTY_ID);

    expect(emptySelection).toEqual({
      hotelId: HOTEL_EMPTY_ID,
      version: 1,
      featuredTourId: null,
      attractTourIds: [],
      items: [],
      updatedAt: HOTEL_EMPTY_CREATED_AT.toISOString(),
    });

    expect(SelectionResponseSchema.parse(emptySelection)).toEqual(emptySelection);
  });

  it('items triés par position', async () => {
    const { service } = harness();

    const selection = await service.get(admin, HOTEL_A_ID);

    expect(selection.items).toEqual([
      { tourId: TOUR_1_ID, position: 0 },
      { tourId: TOUR_2_ID, position: 1 },
      { tourId: TOUR_3_ID, position: 2 },
    ]);
    expect(selection.items.map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it('un éditeur reçoit 404 sur get (aucun hôtel accessible)', async () => {
    const { service } = harness();

    await expect(service.get(editor, HOTEL_A_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
