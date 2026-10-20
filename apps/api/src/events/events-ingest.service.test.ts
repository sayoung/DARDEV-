import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EVENT_CHANNELS,
  EVENT_TYPES,
  type Event,
  type EventsBatch,
} from '@xplor/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  EventsIngestService,
  type EventsIngestPrismaClient,
} from './events-ingest.service.js';

interface RecordedCall {
  data: Prisma.EventCreateManyInput[];
}

function createFakePrisma(): {
  client: EventsIngestPrismaClient;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const client: EventsIngestPrismaClient = {
    event: {
      createMany: vi.fn(
        (args: { data: Prisma.EventCreateManyInput[] }): Promise<Prisma.BatchPayload> => {
          calls.push({ data: args.data });
          return Promise.resolve({ count: args.data.length });
        },
      ),
    },
  };
  return { client, calls };
}

function setupService(): {
  service: EventsIngestService;
  calls: RecordedCall[];
} {
  const { client, calls } = createFakePrisma();
  return { service: new EventsIngestService(client), calls };
}

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    sessionId: overrides.sessionId ?? '01990000-0000-7000-8000-000000000001',
    type: overrides.type ?? EVENT_TYPES.SESSION_START,
    channel: overrides.channel ?? EVENT_CHANNELS.KIOSK,
    tourId: overrides.tourId !== undefined ? overrides.tourId : '01990000-0000-7000-8000-000000000002',
    sceneId: overrides.sceneId !== undefined ? overrides.sceneId : '01990000-0000-7000-8000-000000000003',
    hotspotId: overrides.hotspotId !== undefined ? overrides.hotspotId : '01990000-0000-7000-8000-000000000004',
    lang: overrides.lang ?? 'fr',
    durationMs: overrides.durationMs !== undefined ? overrides.durationMs : 1500,
    occurredAt: overrides.occurredAt ?? '2026-10-20T12:00:00.000Z',
  };
}

describe('EventsIngestService', () => {
  const fixedNow = new Date('2026-10-20T12:00:00.000Z');

  it('force channel, kioskId et hotelId depuis le contexte vérifié malgré les valeurs du client', async () => {
    const { service, calls } = setupService();

    const result = await service.ingest(
      { events: [createEvent({ channel: EVENT_CHANNELS.KIOSK })] },
      {
        channel: EVENT_CHANNELS.WEB,
        kioskId: '01990000-0000-7000-8000-000000000099',
        hotelId: '01990000-0000-7000-8000-000000000088',
      },
      fixedNow,
    );

    expect(result).toEqual({ accepted: 1 });
    expect(calls).toHaveLength(1);
    const row = calls[0]?.data[0];
    expect(row).toBeDefined();
    if (row !== undefined) {
      expect(row.channel).toBe(EVENT_CHANNELS.WEB);
      expect(row.kioskId).toBe('01990000-0000-7000-8000-000000000099');
      expect(row.hotelId).toBe('01990000-0000-7000-8000-000000000088');
    }
  });

  it('affecte null par défaut à kioskId et hotelId quand ils sont omis du contexte', async () => {
    const { service, calls } = setupService();

    const result = await service.ingest(
      { events: [createEvent()] },
      { channel: EVENT_CHANNELS.VR },
      fixedNow,
    );

    expect(result).toEqual({ accepted: 1 });
    const row = calls[0]?.data[0];
    expect(row).toBeDefined();
    if (row !== undefined) {
      expect(row.channel).toBe(EVENT_CHANNELS.VR);
      expect(row.kioskId).toBeNull();
      expect(row.hotelId).toBeNull();
    }
  });

  it('rejette avec BadRequestException sans appeler createMany si occurredAt est à plus de 24 h dans le futur', async () => {
    const { service, calls } = setupService();
    const futureDate = new Date(fixedNow.getTime() + 24 * 60 * 60 * 1000 + 1).toISOString();

    await expect(
      service.ingest(
        { events: [createEvent({ occurredAt: futureDate })] },
        { channel: EVENT_CHANNELS.KIOSK },
        fixedNow,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(calls).toHaveLength(0);
  });

  it('rejette le lot entier si un seul événement est à plus de 24 h dans le futur', async () => {
    const { service, calls } = setupService();
    const validDate = new Date(fixedNow.getTime() - 1000).toISOString();
    const futureDate = new Date(fixedNow.getTime() + 25 * 60 * 60 * 1000).toISOString();

    await expect(
      service.ingest(
        {
          events: [
            createEvent({ occurredAt: validDate }),
            createEvent({ occurredAt: futureDate }),
          ],
        },
        { channel: EVENT_CHANNELS.KIOSK },
        fixedNow,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(calls).toHaveLength(0);
  });

  it('accepte un événement situé exactement à la limite des 24 h futures', async () => {
    const { service, calls } = setupService();
    const limitDate = new Date(fixedNow.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const result = await service.ingest(
      { events: [createEvent({ occurredAt: limitDate })] },
      { channel: EVENT_CHANNELS.WEB },
      fixedNow,
    );

    expect(result).toEqual({ accepted: 1 });
    expect(calls).toHaveLength(1);
  });

  it('ignore sans erreur les événements de plus de 7 jours dans le passé avec le bon compteur accepted', async () => {
    const { service, calls } = setupService();
    const recentDate = new Date(fixedNow.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const threeDaysOldDate = new Date(fixedNow.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysOldDate = new Date(fixedNow.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

    const result = await service.ingest(
      {
        events: [
          createEvent({
            sessionId: '01990000-0000-7000-8000-000000000001',
            occurredAt: recentDate,
          }),
          createEvent({
            sessionId: '01990000-0000-7000-8000-000000000002',
            occurredAt: threeDaysOldDate,
          }),
          createEvent({
            sessionId: '01990000-0000-7000-8000-000000000003',
            occurredAt: eightDaysOldDate,
          }),
        ],
      },
      { channel: EVENT_CHANNELS.KIOSK },
      fixedNow,
    );

    expect(result).toEqual({ accepted: 2 });
    expect(calls).toHaveLength(1);
    const data = calls[0]?.data;
    expect(data).toBeDefined();
    if (data !== undefined) {
      expect(data).toHaveLength(2);
      expect(data[0]?.sessionId).toBe('01990000-0000-7000-8000-000000000001');
      expect(data[1]?.sessionId).toBe('01990000-0000-7000-8000-000000000002');
    }
  });

  it('ne fait aucun appel à createMany et renvoie accepted: 0 quand le lot est entièrement ignoré (> 7 jours)', async () => {
    const { service, calls } = setupService();
    const oldDate1 = new Date(fixedNow.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const oldDate2 = new Date(fixedNow.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const result = await service.ingest(
      {
        events: [
          createEvent({ occurredAt: oldDate1 }),
          createEvent({ occurredAt: oldDate2 }),
        ],
      },
      { channel: EVENT_CHANNELS.WEB },
      fixedNow,
    );

    expect(result).toEqual({ accepted: 0 });
    expect(calls).toHaveLength(0);
  });

  it('rejette avec BadRequestException sans appeler createMany si le lot est invalide', async () => {
    const { service, calls } = setupService();

    const emptyBatch: EventsBatch = { events: [] };
    await expect(
      service.ingest(emptyBatch, { channel: EVENT_CHANNELS.WEB }, fixedNow),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(calls).toHaveLength(0);
  });

  it('mappe correctement tous les champs de l\'événement lors de l\'insertion', async () => {
    const { service, calls } = setupService();
    const occurredIso = '2026-10-20T10:00:00.000Z';

    const result = await service.ingest(
      {
        events: [
          createEvent({
            sessionId: '01990000-0000-7000-8000-000000000011',
            type: EVENT_TYPES.HOTSPOT_CLICK,
            tourId: '01990000-0000-7000-8000-000000000012',
            sceneId: '01990000-0000-7000-8000-000000000013',
            hotspotId: '01990000-0000-7000-8000-000000000014',
            lang: 'ar',
            durationMs: 4200,
            occurredAt: occurredIso,
          }),
        ],
      },
      { channel: EVENT_CHANNELS.VR },
      fixedNow,
    );

    expect(result).toEqual({ accepted: 1 });
    expect(calls).toHaveLength(1);
    const row = calls[0]?.data[0];
    expect(row).toBeDefined();
    if (row !== undefined) {
      expect(row.sessionId).toBe('01990000-0000-7000-8000-000000000011');
      expect(row.type).toBe(EVENT_TYPES.HOTSPOT_CLICK);
      expect(row.channel).toBe(EVENT_CHANNELS.VR);
      expect(row.tourId).toBe('01990000-0000-7000-8000-000000000012');
      expect(row.sceneId).toBe('01990000-0000-7000-8000-000000000013');
      expect(row.hotspotId).toBe('01990000-0000-7000-8000-000000000014');
      expect(row.lang).toBe('ar');
      expect(row.durationMs).toBe(4200);
      expect(row.occurredAt).toEqual(new Date(occurredIso));
    }
  });

  it('ne stocke aucune adresse IP ni aucun en-tête dans les données passées à createMany (NF-02)', async () => {
    const { service, calls } = setupService();

    await service.ingest(
      { events: [createEvent()] },
      { channel: EVENT_CHANNELS.WEB },
      fixedNow,
    );

    expect(calls).toHaveLength(1);
    const row = calls[0]?.data[0];
    expect(row).toBeDefined();
    if (row !== undefined) {
      const forbiddenKeys = [
        'ip',
        'ipAddress',
        'clientIp',
        'headers',
        'userAgent',
        'user_agent',
        'host',
        'referer',
        'referrer',
      ];
      const rowKeys = Object.keys(row);
      for (const forbidden of forbiddenKeys) {
        expect(rowKeys).not.toContain(forbidden);
      }
    }
  });

  it('utilise la date courante par défaut si le paramètre now est omis', async () => {
    const { service, calls } = setupService();

    const result = await service.ingest(
      { events: [createEvent({ occurredAt: new Date().toISOString() })] },
      { channel: EVENT_CHANNELS.KIOSK },
    );

    expect(result).toEqual({ accepted: 1 });
    expect(calls).toHaveLength(1);
  });
});
