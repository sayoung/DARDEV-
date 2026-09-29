import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CategoryCreate } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { CATEGORY_IN_USE_MESSAGE, IN_USE } from './catalog.errors.js';
import { CategoriesService } from './categories.service.js';

const MONUMENTS_ID = '01990000-0000-7000-8000-000000000011';
const PLAGES_ID = '01990000-0000-7000-8000-000000000012';

const monuments: CategoryCreate = {
  name: { fr: 'Monuments', ar: 'مآثر', en: 'Monuments' },
  icon: 'landmark',
  color: '#1F6F8B',
  weight: 1,
};

const plages: CategoryCreate = {
  name: { fr: 'Plages', ar: 'الشواطئ', en: 'Beaches' },
  icon: 'beach',
  color: '#2E86AB',
  weight: 3,
};

interface CategoryRow {
  id: string;
  name: Prisma.InputJsonValue;
  icon: string;
  color: string;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}

function harness(): {
  service: CategoriesService;
  rows: Map<string, CategoryRow>;
  links: Map<string, number>;
  failDelete: (error: Error) => void;
} {
  const rows = new Map<string, CategoryRow>();
  const links = new Map<string, number>();
  let deleteError: Error | null = null;
  let seq = 0;

  const prisma = {
    category: {
      findMany: (): Promise<CategoryRow[]> => Promise.resolve([...rows.values()]),
      findUnique: ({ where }: { where: { id: string } }): Promise<CategoryRow | null> =>
        Promise.resolve(rows.get(where.id) ?? null),
      create: ({
        data,
      }: {
        data: { name: Prisma.InputJsonValue; icon: string; color: string; weight: number };
      }): Promise<CategoryRow> => {
        seq += 1;
        const row: CategoryRow = {
          id: seq === 1 ? PLAGES_ID : MONUMENTS_ID,
          name: data.name,
          icon: data.icon,
          color: data.color,
          weight: data.weight,
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
        data: { name: Prisma.InputJsonValue; icon: string; color: string; weight: number };
      }): Promise<CategoryRow> => {
        const current = rows.get(where.id);
        if (current === undefined) {
          return Promise.reject(missingRecord());
        }
        const row: CategoryRow = {
          ...current,
          ...data,
          updatedAt: new Date('2026-09-29T01:00:00.000Z'),
        };
        rows.set(row.id, row);
        return Promise.resolve(row);
      },
      delete: ({ where }: { where: { id: string } }): Promise<CategoryRow> => {
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
    tourCategory: {
      count: ({ where }: { where: { categoryId: string } }): Promise<number> =>
        Promise.resolve(links.get(where.categoryId) ?? 0),
    },
  } as unknown as PrismaService;

  return {
    service: new CategoriesService(prisma),
    rows,
    links,
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

describe('CategoriesService', () => {
  it('crée une catégorie et la relit', async () => {
    const { service } = harness();
    const created = await service.create(monuments);
    expect(created).toEqual({ id: PLAGES_ID, ...monuments });
    expect(await service.get(PLAGES_ID)).toEqual(created);
  });

  it('trie la liste sur le nom français', async () => {
    const { service } = harness();
    await service.create(plages);
    await service.create(monuments);
    const names = (await service.list()).map((category) => category.name.fr);
    expect(names).toEqual(['Monuments', 'Plages']);
  });

  it('remplace tous les champs', async () => {
    const { service } = harness();
    const created = await service.create(monuments);
    const updated = await service.update(created.id, plages);
    expect(updated.icon).toBe('beach');
    expect(updated.weight).toBe(3);
    expect(updated.color).toBe('#2E86AB');
  });

  it('répond 404 si la catégorie est absente', async () => {
    const { service } = harness();
    await expect(service.get(MONUMENTS_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(MONUMENTS_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('supprime une catégorie sans visite', async () => {
    const { service, rows } = harness();
    const created = await service.create(monuments);
    await service.remove(created.id);
    expect(rows.has(created.id)).toBe(false);
  });

  it('refuse de supprimer une catégorie encore liée à une visite', async () => {
    const { service, rows, links } = harness();
    const created = await service.create(monuments);
    links.set(created.id, 1);
    try {
      await service.remove(created.id);
      expect.unreachable();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) {
        throw error;
      }
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toEqual({
        error: { code: IN_USE, message: CATEGORY_IN_USE_MESSAGE },
      });
    }
    expect(rows.has(created.id)).toBe(true);
  });
});
