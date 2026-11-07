import { describe, expect, it } from 'vitest';
import {
  STATS_DAILY_INTERVAL_MS,
  STATS_DAILY_JOB_ID,
  STATS_DAILY_QUEUE_NAME,
  StatsDailyRecordSchema,
  HOTEL_MONTHLY_REPORT_QUEUE_NAME,
  HOTEL_MONTHLY_REPORT_JOB_ID,
  HOTEL_MONTHLY_REPORT_CRON_PATTERN,
  HotelMonthlyReportPeriodSchema,
  HotelMonthlyReportDataSchema,
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

  it('définit les constantes du job BullMQ de rapport mensuel hôtel (F-83)', () => {
    expect(HOTEL_MONTHLY_REPORT_QUEUE_NAME).toBe('hotel-monthly-report');
    expect(HOTEL_MONTHLY_REPORT_JOB_ID).toBe('hotel-monthly-report');
    expect(HOTEL_MONTHLY_REPORT_CRON_PATTERN).toBe('0 6 1 * *');
  });

  it('valide et rejette la période du rapport mensuel', () => {
    const validPeriod = {
      from: '2026-10-01',
      to: '2026-10-31',
      label: 'Octobre 2026',
    };
    const parsedValid = HotelMonthlyReportPeriodSchema.safeParse(validPeriod);
    expect(parsedValid.success).toBe(true);
    if (parsedValid.success) {
      expect(parsedValid.data.from).toBe('2026-10-01');
      expect(parsedValid.data.to).toBe('2026-10-31');
      expect(parsedValid.data.label).toBe('Octobre 2026');
    }

    const invalidEmpty = {
      from: '',
      to: '2026-10-31',
      label: '',
    };
    expect(HotelMonthlyReportPeriodSchema.safeParse(invalidEmpty).success).toBe(false);

    const invalidMissing = {
      from: '2026-10-01',
    };
    expect(HotelMonthlyReportPeriodSchema.safeParse(invalidMissing).success).toBe(false);
  });

  it('valide une structure HotelMonthlyReportData complète et anonyme sans données personnelles', () => {
    const reportData = {
      hotelId: validHotelId,
      hotelName: 'Hôtel Rabat Palace',
      period: {
        from: '2026-10-01',
        to: '2026-10-31',
        label: 'Octobre 2026',
      },
      summary: {
        sessions: 42,
        averageSessionDurationMs: 180_000,
        toursOpened: 35,
        scenesViewed: 120,
        hotspotClicks: 50,
        vrEntries: 8,
        qrScans: 12,
      },
      topTours: [
        { id: validTourId, label: 'Kasbah des Oudayas', opens: 25 },
      ],
      topScenes: [
        { id: '01990000-0000-7000-8000-000000000003', label: 'Porte Bab Oudaya', views: 80 },
      ],
      languages: [
        { lang: 'fr', sessions: 30 },
        { lang: 'en', sessions: 12 },
      ],
      channels: [
        { channel: 'KIOSK', sessions: 35 },
        { channel: 'WEB', sessions: 7 },
      ],
    };

    const parsed = HotelMonthlyReportDataSchema.safeParse(reportData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hotelId).toBe(validHotelId);
      expect(parsed.data.hotelName).toBe('Hôtel Rabat Palace');
      expect(parsed.data.summary.sessions).toBe(42);
      expect(parsed.data.topTours).toHaveLength(1);
      expect(parsed.data.topScenes).toHaveLength(1);
      expect(parsed.data.languages).toHaveLength(2);
      expect(parsed.data.channels).toHaveLength(2);
    }
  });

  it('rejette HotelMonthlyReportData avec un hotelId invalide ou des valeurs incorrectes', () => {
    const invalidReport = {
      hotelId: 'invalid-uuid',
      hotelName: '',
      period: {
        from: '',
        to: '',
        label: '',
      },
      summary: {
        sessions: -1,
        averageSessionDurationMs: 0,
        toursOpened: 0,
        scenesViewed: 0,
        hotspotClicks: 0,
        vrEntries: 0,
        qrScans: 0,
      },
      topTours: [],
      topScenes: [],
      languages: [],
      channels: [],
    };

    expect(HotelMonthlyReportDataSchema.safeParse(invalidReport).success).toBe(false);
  });

  it('rejette HotelMonthlyReportData avec des compteurs négatifs dans les listes détaillées', () => {
    const baseValid = {
      hotelId: validHotelId,
      hotelName: 'Hôtel Rabat Palace',
      period: {
        from: '2026-10-01',
        to: '2026-10-31',
        label: 'Octobre 2026',
      },
      summary: {
        sessions: 10,
        averageSessionDurationMs: 60_000,
        toursOpened: 5,
        scenesViewed: 15,
        hotspotClicks: 2,
        vrEntries: 0,
        qrScans: 1,
      },
      topTours: [],
      topScenes: [],
      languages: [],
      channels: [],
    };

    const negativeTourOpens = {
      ...baseValid,
      topTours: [{ id: validTourId, label: 'Visite', opens: -1 }],
    };
    expect(HotelMonthlyReportDataSchema.safeParse(negativeTourOpens).success).toBe(false);

    const negativeSceneViews = {
      ...baseValid,
      topScenes: [{ id: '01990000-0000-7000-8000-000000000003', label: 'Scène', views: -1 }],
    };
    expect(HotelMonthlyReportDataSchema.safeParse(negativeSceneViews).success).toBe(false);

    const negativeLangSessions = {
      ...baseValid,
      languages: [{ lang: 'fr', sessions: -5 }],
    };
    expect(HotelMonthlyReportDataSchema.safeParse(negativeLangSessions).success).toBe(false);

    const negativeChannelSessions = {
      ...baseValid,
      channels: [{ channel: 'KIOSK', sessions: -2 }],
    };
    expect(HotelMonthlyReportDataSchema.safeParse(negativeChannelSessions).success).toBe(false);
  });
});
