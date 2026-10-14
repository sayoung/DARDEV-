import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssetKind,
  ContractType,
  ContractTypeSchema,
  HotelStars,
  HotelStarsSchema,
  ProcessingStatus,
  Role,
  z,
  type HotelCreate,
  type Principal,
} from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import {
  CITY_NOT_FOUND,
  CITY_NOT_FOUND_MESSAGE,
} from '../catalog/catalog.errors.js';
import {
  LOGO_ASSET_INVALID,
  LOGO_ASSET_INVALID_MESSAGE,
  LOGO_ASSET_NOT_FOUND,
  LOGO_ASSET_NOT_FOUND_MESSAGE,
} from './hotels.errors.js';
import {
  HotelsService,
  type HotelPrismaClient,
  type HotelRow,
} from './hotels.service.js';

const CITY_ID = '01990000-0000-7000-8000-000000000001';
const UNKNOWN_CITY_ID = '01990000-0000-7000-8000-000000000099';
const LOGO_ASSET_ID = '01990000-0000-7000-8000-000000000002';
const UNKNOWN_ASSET_ID = '01990000-0000-7000-8000-000000000098';
const PENDING_ASSET_ID = '01990000-0000-7000-8000-000000000003';
const AUDIO_ASSET_ID = '01990000-0000-7000-8000-000000000004';
const HOTEL_A_ID = '01990000-0000-7000-8000-000000000101';
const HOTEL_B_ID = '01990000-0000-7000-8000-000000000102';

const hotelAInput: HotelCreate = {
  name: 'Hôtel Oudayas Rabat',
  stars: HotelStars.FIVE,
  cityId: CITY_ID,
  address: '1 avenue des Oudayas, Rabat',
  phone: '+212537000001',
  email: 'oudayas@xplor.local',
  logoAssetId: LOGO_ASSET_ID,
  brandColor: '#6958A5',
  languages: ['fr', 'ar', 'en'],
  contractType: ContractType.RENTAL,
  contractStart: '2026-01-01T00:00:00.000Z',
  contractEnd: '2027-01-01T00:00:00.000Z',
  active: true,
};

const hotelBInput: HotelCreate = {
  name: 'Hôtel Majorelle Marrakech',
  stars: HotelStars.LUXURY,
  cityId: CITY_ID,
  address: '10 avenue Majorelle, Marrakech',
  phone: '+212524000002',
  email: 'majorelle@xplor.local',
  logoAssetId: null,
  brandColor: '#1F6F8B',
  languages: ['fr', 'en'],
  contractType: ContractType.SALE,
  contractStart: '2026-06-01T00:00:00.000Z',
  contractEnd: '2028-06-01T00:00:00.000Z',
  active: true,
};

const admin: Principal = {
  userId: '01990000-0000-7000-8000-000000000201',
  role: Role.ADMIN,
  hotelIds: [],
};

const managerHotelA: Principal = {
  userId: '01990000-0000-7000-8000-000000000202',
  role: Role.HOTEL_MANAGER,
  hotelIds: [HOTEL_A_ID],
};

const editor: Principal = {
  userId: '01990000-0000-7000-8000-000000000204',
  role: Role.EDITOR,
  hotelIds: [],
};

interface AssetRecord {
  id: string;
  kind: AssetKind;
  processingStatus: ProcessingStatus;
}

function missingRecord(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('missing', {
    code: 'P2025',
    clientVersion: '6.19.3',
  });
}

function harness(): {
  service: HotelsService;
  rows: Map<string, HotelRow>;
  cities: Set<string>;
  assets: Map<string, AssetRecord>;
  failUpdate: (error: Error) => void;
} {
  const rows = new Map<string, HotelRow>();
  const cities = new Set<string>([CITY_ID]);
  const assets = new Map<string, AssetRecord>([
    [
      LOGO_ASSET_ID,
      {
        id: LOGO_ASSET_ID,
        kind: AssetKind.IMAGE,
        processingStatus: ProcessingStatus.READY,
      },
    ],
    [
      PENDING_ASSET_ID,
      {
        id: PENDING_ASSET_ID,
        kind: AssetKind.IMAGE,
        processingStatus: ProcessingStatus.PENDING,
      },
    ],
    [
      AUDIO_ASSET_ID,
      {
        id: AUDIO_ASSET_ID,
        kind: AssetKind.AUDIO,
        processingStatus: ProcessingStatus.READY,
      },
    ],
  ]);

  let updateError: Error | null = null;
  let seq = 0;

  const prisma: HotelPrismaClient = {
    hotel: {
      findMany: (args?: {
        where?: Prisma.HotelWhereInput;
        orderBy?: Prisma.HotelOrderByWithRelationInput | Prisma.HotelOrderByWithRelationInput[];
      }): Promise<HotelRow[]> => {
        let result = [...rows.values()];
        if (args?.where) {
          if (args.where.deletedAt === null) {
            result = result.filter((r) => r.deletedAt === null);
          }
          const idFilter = args.where.id;
          if (typeof idFilter === 'object' && 'in' in idFilter) {
            const allowed = idFilter.in;
            if (Array.isArray(allowed)) {
              result = result.filter((r) => allowed.includes(r.id));
            }
          }
        }
        return Promise.resolve(result);
      },

      findFirst: (args: {
        where: Prisma.HotelWhereInput;
      }): Promise<HotelRow | null> => {
        let result = [...rows.values()];
        if (typeof args.where.id === 'string') {
          result = result.filter((r) => r.id === args.where.id);
        }
        if (args.where.deletedAt === null) {
          result = result.filter((r) => r.deletedAt === null);
        }
        return Promise.resolve(result[0] ?? null);
      },

      create: (args: {
        data: Prisma.HotelUncheckedCreateInput;
      }): Promise<HotelRow> => {
        seq += 1;
        const rowId =
          typeof args.data.id === 'string'
            ? args.data.id
            : seq === 1
              ? HOTEL_A_ID
              : HOTEL_B_ID;

        const row: HotelRow = {
          id: rowId,
          name: z.string().parse(args.data.name),
          stars: HotelStarsSchema.parse(args.data.stars),
          cityId: z.string().parse(args.data.cityId),
          address: z.string().parse(args.data.address),
          phone: z.string().parse(args.data.phone),
          email: z.string().parse(args.data.email),
          logoAssetId: z.string().nullable().parse(args.data.logoAssetId ?? null),
          brandColor: z.string().parse(args.data.brandColor),
          languages: z.array(z.string()).parse(args.data.languages ?? ['fr']),
          contractType: ContractTypeSchema.parse(args.data.contractType),
          contractStart:
            args.data.contractStart instanceof Date
              ? args.data.contractStart
              : new Date(),
          contractEnd:
            args.data.contractEnd instanceof Date
              ? args.data.contractEnd
              : new Date(),
          maintenancePinHash:
            typeof args.data.maintenancePinHash === 'string'
              ? args.data.maintenancePinHash
              : null,
          active:
            typeof args.data.active === 'boolean' ? args.data.active : true,
          deletedAt: null,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          updatedAt: new Date('2026-10-01T00:00:00.000Z'),
        };
        rows.set(row.id, row);
        return Promise.resolve(row);
      },

      update: (args: {
        where: Prisma.HotelWhereUniqueInput;
        data: Prisma.HotelUncheckedUpdateInput;
      }): Promise<HotelRow> => {
        if (updateError !== null) {
          return Promise.reject(updateError);
        }
        const current = rows.get(String(args.where.id));
        if (current === undefined) {
          return Promise.reject(missingRecord());
        }
        const updated: HotelRow = {
          ...current,
          ...(args.data.name !== undefined
            ? { name: z.string().parse(args.data.name) }
            : {}),
          ...(args.data.stars !== undefined
            ? { stars: HotelStarsSchema.parse(args.data.stars) }
            : {}),
          ...(args.data.cityId !== undefined
            ? { cityId: z.string().parse(args.data.cityId) }
            : {}),
          ...(args.data.address !== undefined
            ? { address: z.string().parse(args.data.address) }
            : {}),
          ...(args.data.phone !== undefined
            ? { phone: z.string().parse(args.data.phone) }
            : {}),
          ...(args.data.email !== undefined
            ? { email: z.string().parse(args.data.email) }
            : {}),
          ...(args.data.logoAssetId !== undefined
            ? { logoAssetId: z.string().nullable().parse(args.data.logoAssetId) }
            : {}),
          ...(args.data.brandColor !== undefined
            ? { brandColor: z.string().parse(args.data.brandColor) }
            : {}),
          ...(args.data.languages !== undefined
            ? { languages: z.array(z.string()).parse(args.data.languages) }
            : {}),
          ...(args.data.contractType !== undefined
            ? { contractType: ContractTypeSchema.parse(args.data.contractType) }
            : {}),
          ...(args.data.contractStart instanceof Date
            ? { contractStart: args.data.contractStart }
            : {}),
          ...(args.data.contractEnd instanceof Date
            ? { contractEnd: args.data.contractEnd }
            : {}),
          ...(args.data.active !== undefined
            ? { active: z.boolean().parse(args.data.active) }
            : {}),
          ...(args.data.deletedAt instanceof Date || args.data.deletedAt === null
            ? { deletedAt: args.data.deletedAt }
            : {}),
          updatedAt: new Date('2026-10-02T00:00:00.000Z'),
        };
        rows.set(updated.id, updated);
        return Promise.resolve(updated);
      },
    },

    city: {
      findUnique: (args: {
        where: Prisma.CityWhereUniqueInput;
        select?: Prisma.CitySelect;
      }): Promise<{ id: string } | null> => {
        const id = String(args.where.id);
        if (cities.has(id)) {
          return Promise.resolve({ id });
        }
        return Promise.resolve(null);
      },
    },

    asset: {
      findUnique: (args: {
        where: Prisma.AssetWhereUniqueInput;
        select?: Prisma.AssetSelect;
      }): Promise<AssetRecord | null> => {
        const id = String(args.where.id);
        const found = assets.get(id);
        if (found !== undefined) {
          return Promise.resolve(found);
        }
        return Promise.resolve(null);
      },
    },
  };

  return {
    service: new HotelsService(prisma),
    rows,
    cities,
    assets,
    failUpdate: (error: Error) => {
      updateError = error;
    },
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
      const res = error.getResponse();
      if (typeof res === 'object' && 'error' in res) {
        const rawError: unknown = res.error;
        if (
          typeof rawError === 'object' &&
          rawError !== null &&
          'code' in rawError &&
          'message' in rawError
        ) {
          return { code: String(rawError.code), message: String(rawError.message) };
        }
      }
    }
    throw error;
  }
  throw new Error('Erreur 422 attendue mais non levée');
}

describe('HotelsService', () => {
  it('crée un hôtel complet et le relit', async () => {
    const { service } = harness();
    const created = await service.create(hotelAInput);
    expect(created.id).toBe(HOTEL_A_ID);
    expect(created.name).toBe(hotelAInput.name);
    expect(created.stars).toBe(HotelStars.FIVE);
    expect(created.brandColor).toBe('#6958A5');
    expect(created.hasMaintenancePin).toBe(false);

    const fetched = await service.get(admin, HOTEL_A_ID);
    expect(fetched).toEqual(created);
  });

  it('ADMIN voit tout (list et get)', async () => {
    const { service } = harness();
    await service.create(hotelAInput);
    await service.create(hotelBInput);

    const list = await service.list(admin);
    expect(list).toHaveLength(2);
    expect(list.map((h) => h.id)).toEqual([HOTEL_B_ID, HOTEL_A_ID]);

    const hotelA = await service.get(admin, HOTEL_A_ID);
    expect(hotelA.name).toBe('Hôtel Oudayas Rabat');

    const hotelB = await service.get(admin, HOTEL_B_ID);
    expect(hotelB.name).toBe('Hôtel Majorelle Marrakech');
  });

  it('gestionnaire de l’hôtel A ne voit pas l’hôtel B (list et get)', async () => {
    const { service } = harness();
    await service.create(hotelAInput);
    await service.create(hotelBInput);

    const list = await service.list(managerHotelA);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(HOTEL_A_ID);
    expect(list.some((h) => h.id === HOTEL_B_ID)).toBe(false);

    const hotelA = await service.get(managerHotelA, HOTEL_A_ID);
    expect(hotelA.id).toBe(HOTEL_A_ID);

    await expect(service.get(managerHotelA, HOTEL_B_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('suppression logique (deletedAt renseigné et active = false)', async () => {
    const { service, rows } = harness();
    const created = await service.create(hotelAInput);

    await service.remove(created.id);

    const rowInDb = rows.get(created.id);
    expect(rowInDb).toBeDefined();
    if (rowInDb !== undefined) {
      expect(rowInDb.deletedAt).toBeInstanceOf(Date);
      expect(rowInDb.active).toBe(false);
    }

    await expect(service.get(admin, created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const list = await service.list(admin);
    expect(list).toHaveLength(0);

    await expect(service.remove(created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('répond 422 si la ville est inconnue (création et mise à jour)', async () => {
    const { service } = harness();

    const createError = await readReferenceError(
      service.create({ ...hotelAInput, cityId: UNKNOWN_CITY_ID }),
    );
    expect(createError.code).toBe(CITY_NOT_FOUND);
    expect(createError.message).toBe(CITY_NOT_FOUND_MESSAGE);

    const created = await service.create(hotelAInput);

    const updateError = await readReferenceError(
      service.update(created.id, { cityId: UNKNOWN_CITY_ID }),
    );
    expect(updateError.code).toBe(CITY_NOT_FOUND);
    expect(updateError.message).toBe(CITY_NOT_FOUND_MESSAGE);
  });

  it('réponse sans hash et exposition de hasMaintenancePin', async () => {
    const { service, rows } = harness();
    const created = await service.create(hotelAInput);

    expect(created.hasMaintenancePin).toBe(false);
    expect('maintenancePinHash' in created).toBe(false);
    expect(created).not.toHaveProperty('maintenancePinHash');

    const rowInDb = rows.get(created.id);
    if (rowInDb !== undefined) {
      rowInDb.maintenancePinHash =
        '$argon2id$v=19$m=65536,t=3,p=4$secretHashValue123';
    }

    const fetched = await service.get(admin, created.id);
    expect(fetched.hasMaintenancePin).toBe(true);
    expect('maintenancePinHash' in fetched).toBe(false);
    expect(fetched).not.toHaveProperty('maintenancePinHash');

    const list = await service.list(admin);
    expect(list[0]?.hasMaintenancePin).toBe(true);
    expect('maintenancePinHash' in (list[0] ?? {})).toBe(false);
  });

  it('valide que logoAssetId est un Asset READY de type image', async () => {
    const { service } = harness();

    const missingLogo = await readReferenceError(
      service.create({ ...hotelAInput, logoAssetId: UNKNOWN_ASSET_ID }),
    );
    expect(missingLogo.code).toBe(LOGO_ASSET_NOT_FOUND);
    expect(missingLogo.message).toBe(LOGO_ASSET_NOT_FOUND_MESSAGE);

    const notReadyLogo = await readReferenceError(
      service.create({ ...hotelAInput, logoAssetId: PENDING_ASSET_ID }),
    );
    expect(notReadyLogo.code).toBe(LOGO_ASSET_INVALID);
    expect(notReadyLogo.message).toBe(LOGO_ASSET_INVALID_MESSAGE);

    const audioLogo = await readReferenceError(
      service.create({ ...hotelAInput, logoAssetId: AUDIO_ASSET_ID }),
    );
    expect(audioLogo.code).toBe(LOGO_ASSET_INVALID);
    expect(audioLogo.message).toBe(LOGO_ASSET_INVALID_MESSAGE);

    const withoutLogo = await service.create({
      ...hotelAInput,
      logoAssetId: null,
    });
    expect(withoutLogo.logoAssetId).toBeNull();
  });

  it('trie la liste par nom alphabétique en français', async () => {
    const { service } = harness();
    await service.create(hotelAInput);
    await service.create(hotelBInput);

    const list = await service.list(admin);
    const names = list.map((h) => h.name);
    expect(names).toEqual(['Hôtel Majorelle Marrakech', 'Hôtel Oudayas Rabat']);
  });

  it('EDITOR ne voit aucun hôtel (list vide et get 404)', async () => {
    const { service } = harness();
    const created = await service.create(hotelAInput);

    const list = await service.list(editor);
    expect(list).toEqual([]);

    await expect(service.get(editor, created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('met à jour un hôtel et gère la disparition P2025', async () => {
    const { service, failUpdate } = harness();
    const created = await service.create(hotelAInput);

    const updated = await service.update(created.id, {
      name: 'Hôtel Oudayas Relais & Châteaux',
      brandColor: '#2C3E50',
    });
    expect(updated.name).toBe('Hôtel Oudayas Relais & Châteaux');
    expect(updated.brandColor).toBe('#2C3E50');

    failUpdate(missingRecord());
    await expect(
      service.update(created.id, { name: 'Autre Nom' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('répond 404 pour get, update et remove sur un hôtel inexistant', async () => {
    const { service } = harness();
    const unknownId = '01990000-0000-7000-8000-000000000999';

    await expect(service.get(admin, unknownId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update(unknownId, { name: 'Nouveau' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(unknownId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
