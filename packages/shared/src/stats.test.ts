import { describe, expect, it } from 'vitest';
import {
  STATS_DAILY_INTERVAL_MS,
  STATS_DAILY_JOB_ID,
  STATS_DAILY_QUEUE_NAME,
  StatsDailyRecordSchema,
} from './stats.js';
import { EVENT_CHANNELS } from './events.js';

const validHotelId = '01990000-0000-7000-8000-000000000001';
const validTourId = '01990000-0000-7000-8000-000000000002';

describe('stats shared', () => {
  it('définit les constantes du job BullMQ horaire', () => {
    expect(STATS_DAILY_QUEUE_NAME).toBe('stats-daily-aggregation');
    expect(STATS_DAILY_JOB_ID).toBe('stats-daily-aggregation');
    expect(STATS_DAILY_INTERVAL_MS).toBe(3_600_000);
  });

  it('valide un enregistrement StatsDaily valide avec identifiants nuls', () => {
    const validData = {
      day: new Date('2026-10-23T00:00:00.000Z'),
      bucketKey: 'none:none:WEB:fr',
      hotelId: null,
      tourId: null,
      channel: EVENT_CHANNELS.WEB,
      lang: 'fr',
      sessions: 5,
      toursOpened: 10,
      scenesViewed: 25,
      hotspotClicks: 8,
      audioPlays: 3,
      vrEntries: 0,
      qrShown: 2,
      sessionDurationMs: 120_000n,
    };

    const parsed = StatsDailyRecordSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.bucketKey).toBe('none:none:WEB:fr');
      expect(parsed.data.sessionDurationMs).toBe(120_000n);
      expect(parsed.data.hotelId).toBeNull();
      expect(parsed.data.tourId).toBeNull();
    }
  });

  it('valide un enregistrement StatsDaily valide avec hotelId et tourId UUID', () => {
    const validData = {
      day: new Date('2026-10-23T00:00:00.000Z'),
      bucketKey: `${validHotelId}:${validTourId}:KIOSK:ar`,
      hotelId: validHotelId,
      tourId: validTourId,
      channel: EVENT_CHANNELS.KIOSK,
      lang: 'ar',
      sessions: 1,
      toursOpened: 2,
      scenesViewed: 3,
      hotspotClicks: 4,
      audioPlays: 5,
      vrEntries: 6,
      qrShown: 7,
      sessionDurationMs: 50_000n,
    };

    const parsed = StatsDailyRecordSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hotelId).toBe(validHotelId);
      expect(parsed.data.tourId).toBe(validTourId);
      expect(parsed.data.channel).toBe(EVENT_CHANNELS.KIOSK);
    }
  });

  it('rejette un enregistrement avec un canal invalide ou des compteurs négatifs', () => {
    const invalidData = {
      day: new Date('2026-10-23T00:00:00.000Z'),
      bucketKey: 'none:none:UNKNOWN:fr',
      hotelId: null,
      tourId: null,
      channel: 'INVALID_CHANNEL',
      lang: 'fr',
      sessions: -1,
      toursOpened: 0,
      scenesViewed: 0,
      hotspotClicks: 0,
      audioPlays: 0,
      vrEntries: 0,
      qrShown: 0,
      sessionDurationMs: 0n,
    };

    const parsed = StatsDailyRecordSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  it('rejette un enregistrement avec un hotelId ou tourId non-UUID', () => {
    const invalidHotelId = {
      day: new Date('2026-10-23T00:00:00.000Z'),
      bucketKey: 'invalid:none:WEB:fr',
      hotelId: 'not-an-uuid',
      tourId: null,
      channel: EVENT_CHANNELS.WEB,
      lang: 'fr',
      sessions: 0,
      toursOpened: 0,
      scenesViewed: 0,
      hotspotClicks: 0,
      audioPlays: 0,
      vrEntries: 0,
      qrShown: 0,
      sessionDurationMs: 0n,
    };
    expect(StatsDailyRecordSchema.safeParse(invalidHotelId).success).toBe(false);

    const invalidTourId = {
      day: new Date('2026-10-23T00:00:00.000Z'),
      bucketKey: 'none:invalid:WEB:fr',
      hotelId: null,
      tourId: 'not-an-uuid',
      channel: EVENT_CHANNELS.WEB,
      lang: 'fr',
      sessions: 0,
      toursOpened: 0,
      scenesViewed: 0,
      hotspotClicks: 0,
      audioPlays: 0,
      vrEntries: 0,
      qrShown: 0,
      sessionDurationMs: 0n,
    };
    expect(StatsDailyRecordSchema.safeParse(invalidTourId).success).toBe(false);
  });
});
