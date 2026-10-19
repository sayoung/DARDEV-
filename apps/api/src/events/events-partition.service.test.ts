import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  EventsPartitionService,
  formatPartitionName,
  getPartitionDates,
  type EventsPrismaClient,
} from './events-partition.service.js';

interface RecordedCall {
  query: TemplateStringsArray | Prisma.Sql;
  values: unknown[];
}

function createFakePrisma(options?: {
  onExecute?: (query: TemplateStringsArray | Prisma.Sql, values: unknown[]) => Promise<number>;
}): {
  client: EventsPrismaClient;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const client: EventsPrismaClient = {
    $executeRaw: (
      query: TemplateStringsArray | Prisma.Sql,
      ...values: unknown[]
    ): Promise<number> => {
      calls.push({ query, values });
      if (options?.onExecute !== undefined) {
        return options.onExecute(query, values);
      }
      return Promise.resolve(1);
    },
  };
  return { client, calls };
}

describe('EventsPartitionService helpers', () => {
  it('getPartitionDates calcule le 1er jour UTC du mois et des 2 mois suivants', () => {
    const now = new Date(Date.UTC(2026, 4, 15, 12, 30, 0));
    const dates = getPartitionDates(now);

    expect(dates).toHaveLength(3);
    const date0 = dates[0];
    const date1 = dates[1];
    const date2 = dates[2];
    expect(date0).toBeDefined();
    expect(date1).toBeDefined();
    expect(date2).toBeDefined();

    if (date0 !== undefined && date1 !== undefined && date2 !== undefined) {
      expect(date0.toISOString()).toBe('2026-05-01T00:00:00.000Z');
      expect(date1.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(date2.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    }
  });

  it('getPartitionDates gère le passage d\'année (nov. -> janv.)', () => {
    const now = new Date(Date.UTC(2026, 10, 20, 18, 0, 0));
    const dates = getPartitionDates(now);

    expect(dates).toHaveLength(3);
    const date0 = dates[0];
    const date1 = dates[1];
    const date2 = dates[2];
    expect(date0).toBeDefined();
    expect(date1).toBeDefined();
    expect(date2).toBeDefined();

    if (date0 !== undefined && date1 !== undefined && date2 !== undefined) {
      expect(date0.toISOString()).toBe('2026-11-01T00:00:00.000Z');
      expect(date1.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(date2.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    }
  });

  it('getPartitionDates gère la fin de mois (31 janvier sans saut de février)', () => {
    const now = new Date(Date.UTC(2026, 0, 31, 23, 59, 59));
    const dates = getPartitionDates(now);

    expect(dates).toHaveLength(3);
    const date0 = dates[0];
    const date1 = dates[1];
    const date2 = dates[2];
    expect(date0).toBeDefined();
    expect(date1).toBeDefined();
    expect(date2).toBeDefined();

    if (date0 !== undefined && date1 !== undefined && date2 !== undefined) {
      expect(date0.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(date1.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      expect(date2.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    }
  });

  it('getPartitionDates utilise la date courante par défaut', () => {
    const dates = getPartitionDates();
    expect(dates).toHaveLength(3);
  });

  it('getPartitionDates lève une erreur si la date est invalide', () => {
    const invalidDate = new Date('date-invalide');
    expect(() => getPartitionDates(invalidDate)).toThrow('Date invalide');
  });

  it('formatPartitionName formate une date en Event_YYYY_MM', () => {
    expect(formatPartitionName(new Date(Date.UTC(2026, 4, 1)))).toBe('Event_2026_05');
    expect(formatPartitionName(new Date(Date.UTC(2026, 11, 1)))).toBe('Event_2026_12');
    expect(formatPartitionName(new Date(Date.UTC(2027, 0, 1)))).toBe('Event_2027_01');
    expect(formatPartitionName(new Date(Date.UTC(2027, 8, 1)))).toBe('Event_2027_09');
  });

  it('formatPartitionName lève une erreur si la date est invalide', () => {
    const invalidDate = new Date('date-invalide');
    expect(() => formatPartitionName(invalidDate)).toThrow('Date invalide');
  });
});

describe('EventsPartitionService', () => {
  it('ensurePartitions effectue 3 appels pour mai/juin/juillet', async () => {
    const { client, calls } = createFakePrisma();
    const service = new EventsPartitionService(client);

    const now = new Date(Date.UTC(2026, 4, 10, 8, 0, 0));
    await service.ensurePartitions(now);

    expect(calls).toHaveLength(3);

    const call0 = calls[0];
    const call1 = calls[1];
    const call2 = calls[2];
    expect(call0).toBeDefined();
    expect(call1).toBeDefined();
    expect(call2).toBeDefined();

    if (call0 !== undefined && call1 !== undefined && call2 !== undefined) {
      expect(call0.values).toHaveLength(1);
      expect(call1.values).toHaveLength(1);
      expect(call2.values).toHaveLength(1);

      expect(call0.values[0]).toEqual(new Date(Date.UTC(2026, 4, 1)));
      expect(call1.values[0]).toEqual(new Date(Date.UTC(2026, 5, 1)));
      expect(call2.values[0]).toEqual(new Date(Date.UTC(2026, 6, 1)));

      if (Array.isArray(call0.query)) {
        expect(call0.query.join('')).toContain('SELECT create_event_partition(');
        expect(call0.query.join('')).toContain('::date)');
      }
    }
  });

  it('ensurePartitions gère le passage d\'année (nov. -> janv.)', async () => {
    const { client, calls } = createFakePrisma();
    const service = new EventsPartitionService(client);

    const now = new Date(Date.UTC(2026, 10, 25));
    await service.ensurePartitions(now);

    expect(calls).toHaveLength(3);

    const call0 = calls[0];
    const call1 = calls[1];
    const call2 = calls[2];
    expect(call0).toBeDefined();
    expect(call1).toBeDefined();
    expect(call2).toBeDefined();

    if (call0 !== undefined && call1 !== undefined && call2 !== undefined) {
      expect(call0.values[0]).toEqual(new Date(Date.UTC(2026, 10, 1)));
      expect(call1.values[0]).toEqual(new Date(Date.UTC(2026, 11, 1)));
      expect(call2.values[0]).toEqual(new Date(Date.UTC(2027, 0, 1)));
    }
  });

  it('ensurePartitions lève une erreur si la date est invalide', async () => {
    const { client } = createFakePrisma();
    const service = new EventsPartitionService(client);

    const invalidDate = new Date('invalide');
    await expect(service.ensurePartitions(invalidDate)).rejects.toThrow('Date invalide');
  });

  it('ensurePartitions utilise la date courante par défaut', async () => {
    const { client, calls } = createFakePrisma();
    const service = new EventsPartitionService(client);

    await service.ensurePartitions();
    expect(calls).toHaveLength(3);
  });

  it('onModuleInit n\'échoue pas si le client lève une erreur (NF-04)', async () => {
    const failingClient: EventsPrismaClient = {
      $executeRaw: (): Promise<number> =>
        Promise.reject(new Error('connection refused: database unavailable')),
    };
    const service = new EventsPartitionService(failingClient);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('onModuleInit appelle ensurePartitions avec succès', async () => {
    const { client, calls } = createFakePrisma();
    const service = new EventsPartitionService(client);

    await service.onModuleInit();
    expect(calls).toHaveLength(3);
  });
});
