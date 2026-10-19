import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { EventsPartitionService } from '../src/events/events-partition.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { readDatabaseUrlTest } from './global-setup.js';

const TableRowSchema = z.object({
  relname: z.string(),
});
const TableRowsSchema = z.array(TableRowSchema);

const databaseUrl = readDatabaseUrlTest();
const savedDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaService({
  datasourceUrl: databaseUrl,
  errorFormat: 'minimal',
});
const service = new EventsPartitionService(prisma);

async function dropTestPartitions(client: PrismaService): Promise<void> {
  await client.$executeRaw`
    DROP TABLE IF EXISTS
      "Event_2032_04",
      "Event_2032_05",
      "Event_2032_06",
      "Event_2032_11",
      "Event_2032_12",
      "Event_2033_01"
    CASCADE;
  `;
}

async function findPartitionTables(
  client: PrismaService,
  names: readonly string[],
): Promise<string[]> {
  const rows = await client.$queryRaw`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  `;
  const parsed = TableRowsSchema.safeParse(rows);
  if (!parsed.success) {
    throw new Error(`Structure pg_class inattendue : ${parsed.error.message}`);
  }
  const nameSet = new Set(names);
  return parsed.data
    .map((row) => row.relname)
    .filter((name) => nameSet.has(name));
}

beforeAll(async () => {
  await dropTestPartitions(prisma);
});

afterAll(async () => {
  await dropTestPartitions(prisma);
  await prisma.$disconnect();
  if (savedDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = savedDatabaseUrl;
  }
});

describe('EventsPartitionService (test d’intégration M7 F-80)', () => {
  it('crée les partitions pour le mois courant et les deux mois suivants (avril 2032)', async () => {
    const targetDate = new Date('2032-04-15T00:00:00Z');
    await service.ensurePartitions(targetDate);

    const tables = await findPartitionTables(prisma, [
      'Event_2032_04',
      'Event_2032_05',
      'Event_2032_06',
    ]);

    expect(tables).toHaveLength(3);
    expect(tables).toEqual(
      expect.arrayContaining(['Event_2032_04', 'Event_2032_05', 'Event_2032_06']),
    );
  });

  it('est idempotent : un second appel identique ne lève pas d’erreur', async () => {
    const targetDate = new Date('2032-04-15T00:00:00Z');
    await expect(service.ensurePartitions(targetDate)).resolves.toBeUndefined();

    const tables = await findPartitionTables(prisma, [
      'Event_2032_04',
      'Event_2032_05',
      'Event_2032_06',
    ]);

    expect(tables).toHaveLength(3);
    expect(tables).toEqual(
      expect.arrayContaining(['Event_2032_04', 'Event_2032_05', 'Event_2032_06']),
    );
  });

  it('gère le passage d’année (novembre 2032 -> Event_2032_11, Event_2032_12, Event_2033_01)', async () => {
    const targetDate = new Date('2032-11-15T00:00:00Z');
    await service.ensurePartitions(targetDate);

    const tables = await findPartitionTables(prisma, [
      'Event_2032_11',
      'Event_2032_12',
      'Event_2033_01',
    ]);

    expect(tables).toHaveLength(3);
    expect(tables).toEqual(
      expect.arrayContaining(['Event_2032_11', 'Event_2032_12', 'Event_2033_01']),
    );
  });

  it('rejette une date invalide avec une erreur explicite', async () => {
    const invalidDate = new Date('date-invalide');
    await expect(service.ensurePartitions(invalidDate)).rejects.toThrow('Date invalide');
  });
});
