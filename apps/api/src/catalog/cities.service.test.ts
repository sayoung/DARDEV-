import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CityCreate } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { CITY_IN_USE_MESSAGE, IN_USE } from './catalog.errors.js';
import { CitiesService } from './cities.service.js';

const RABAT_ID = '01990000-0000-7000-8000-000000000001';
const SALE_ID = '01990000-0000-7000-8000-000000000002';

const rabat: CityCreate = {
  name: { fr: 'Rabat', ar: 'الرباط', en: 'Rabat' },
  region: 'Rabat-Salé-Kénitra',
  lat: 34.02,
  lng: -6.84,
};

const sale: CityCreate = {
  name: { fr: 'Salé', en: 'Sale' },
  region: 'Rabat-Salé-Kénitra',
  lat: 34.04,
  lng: -6.8,
};

interface CityRow {
  id: string;
  name: Prisma.InputJsonValue;
  region: string;
  lat: number;
  lng: number;
  createdAt: Date;
  updatedAt: Date;
}

function harness(): {
  service: CitiesService;
  rows: Map<string, CityRow>;
  tours: Map<string, number>;
  failDelete: (error: Error) => void;
} {
  const rows = new Map<string, CityRow>();
  const tours = new Map<string, number>();
  let deleteError: Error | null = null;
  let seq = 0;

  const prisma = {
    city: {
      findMany: (): Promise<CityRow[]> => Promise.resolve([...rows.values()]),
      findUnique: ({ where }: { where: { id: string } }): Promise<CityRow | null> =>
        Promise.resolve(rows.get(where.id) ?? null),
      create: ({
        data,
      }: {
        data: { name: Prisma.InputJsonValue; region: string; lat: number; lng: number };
      }): Promise<CityRow> => {
        seq += 1;
        const row: CityRow = {
          id: seq === 1 ? RABAT_ID : SALE_ID,
          name: data.name,
          region: data.region,
          lat: data.lat,
          lng: data.lng,
          createdAt: new Date('2026-09-29T00:00:00.000Z'),
          updatedAt: new Date('2026-09-29T00:00:00.000Z'),
        };
        rows.set(row.id, row);
        return Promise.resolve(row);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { name: Prisma.InputJsonValue; region: string; lat: number; lng: number };
      }): Promise<CityRow> => {
        const current = rows.get(where.id);
        if (current === undefined) {
          return Promise.reject(missingRecord());
        }
        const row: CityRow = { ...current, ...data, updatedAt: new Date('2026-09-29T01:00:00.000Z') };
        rows.set(row.id, row);
        return Promise.resolve(row);
      },
      delete: ({ where }: { where: { id: string } }): Promise<CityRow> => {
        if (deleteError !== null) {
          return Promise.reject(deleteError);
        }
        const current = rows.get(where.id);
        if (current === undefined) {
          return Promise.reject(missingRecord());
        }
        rows.delete(where.id);
        return Promise.resolve(current);
      },
    },
    tour: {
      count: ({ where }: { where: { cityId: string } }): Promise<number> =>
        Promise.resolve(tours.get(where.cityId) ?? 0),
    },
  } as unknown as PrismaService;

  return {
    service: new CitiesService(prisma),
    rows,
    tours,
    failDelete: (error: Error) => {
      deleteError = error;
    },
  };
}

function missingRecord(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('missing', {
    code: 'P2025',
    clientVersion: '6.19.3',
  });
}

function foreignKey(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('fk', {
    code: 'P2003',
    clientVersion: '6.19.3',
  });
}

describe('CitiesService', () => {
  it('crée une ville et la relit', async () => {
    const { service } = harness();
    const created = await service.create(rabat);
    expect(created).toEqual({ id: RABAT_ID, ...rabat });
    expect(await service.get(RABAT_ID)).toEqual(created);
  });

  it('trie la liste sur le nom français', async () => {
    const { service } = harness();
    await service.create(sale);
    await service.create(rabat);
    const names = (await service.list()).map((city) => city.name.fr);
    expect(names).toEqual(['Rabat', 'Salé']);
  });

  it('remplace tous les champs', async () => {
    const { service } = harness();
    const created = await service.create(rabat);
    const updated = await service.update(created.id, sale);
    expect(updated).toEqual({ id: created.id, ...sale });
    expect(updated.name.ar).toBeUndefined();
  });

  it('répond 404 si la ville est absente', async () => {
    const { service } = harness();
    await expect(service.get(RABAT_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(RABAT_ID, rabat)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(RABAT_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('supprime une ville sans visite', async () => {
    const { service, rows } = harness();
    const created = await service.create(rabat);
    await service.remove(created.id);
    expect(rows.has(created.id)).toBe(false);
  });

  it('refuse de supprimer une ville encore liée à une visite', async () => {
    const { service, rows, tours } = harness();
    const created = await service.create(rabat);
    tours.set(created.id, 1);
    await expect(readInUse(service.remove(created.id))).resolves.toBe(CITY_IN_USE_MESSAGE);
    expect(rows.has(created.id)).toBe(true);
  });

  it('traduit une clé étrangère apparue entre le comptage et le DELETE en 409', async () => {
    const { service, failDelete } = harness();
    const created = await service.create(rabat);
    failDelete(foreignKey());
    await expect(readInUse(service.remove(created.id))).resolves.toBe(CITY_IN_USE_MESSAGE);
  });

  it('répond 404 si la ligne disparaît pendant le DELETE', async () => {
    const { service, failDelete } = harness();
    const created = await service.create(rabat);
    failDelete(missingRecord());
    await expect(service.remove(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

async function readInUse(pending: Promise<unknown>): Promise<string> {
  try {
    await pending;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(HttpException);
    if (!(error instanceof HttpException)) {
      throw error;
    }
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      error: { code: IN_USE, message: CITY_IN_USE_MESSAGE },
    });
    return CITY_IN_USE_MESSAGE;
  }
  throw new Error('réponse IN_USE absente');
}
