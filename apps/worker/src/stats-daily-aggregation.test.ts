import { describe, expect, it } from 'vitest';
import {
  EVENT_CHANNELS,
  EVENT_TYPES,
} from '@xplor/shared';
import {
  aggregateEventsForDay,
  buildBucketKey,
  getDayUtcRange,
  getYesterdayAndTodayUtc,
  type StatsDailySourceEvent,
} from './stats-daily-aggregation.js';

const hotelA = '01990000-0000-7000-8000-000000000001';
const hotelB = '01990000-0000-7000-8000-000000000002';
const tour1 = '01990000-0000-7000-8000-000000000011';
const tour2 = '01990000-0000-7000-8000-000000000012';

describe('stats-daily-aggregation', () => {
  describe('buildBucketKey', () => {
    it('génère une clé déterministe avec hotelId et tourId', () => {
      const key = buildBucketKey({
        hotelId: hotelA,
        tourId: tour1,
        channel: EVENT_CHANNELS.WEB,
        lang: 'fr',
      });
      expect(key).toBe(`${hotelA}:${tour1}:WEB:fr`);
      expect(key.length).toBeLessThanOrEqual(128);
    });

    it('génère none lorsque hotelId ou tourId sont absents ou nuls', () => {
      const key = buildBucketKey({
        hotelId: null,
        tourId: undefined,
        channel: EVENT_CHANNELS.KIOSK,
        lang: 'ar',
      });
      expect(key).toBe('none:none:KIOSK:ar');
    });
  });

  describe('getYesterdayAndTodayUtc', () => {
    it('calcule correctement hier et aujourd’hui à minuit UTC', () => {
      const ref = new Date('2026-10-23T14:30:00.000Z');
      const { yesterday, today } = getYesterdayAndTodayUtc(ref);

      expect(today.toISOString()).toBe('2026-10-23T00:00:00.000Z');
      expect(yesterday.toISOString()).toBe('2026-10-22T00:00:00.000Z');
    });

    it('gère le passage de mois et d’année sans débordement', () => {
      const ref = new Date('2026-01-01T02:00:00.000Z');
      const { yesterday, today } = getYesterdayAndTodayUtc(ref);

      expect(today.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(yesterday.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    });
  });

  describe('getDayUtcRange', () => {
    it('définit une fenêtre de 24h exactes [dayStart, dayEnd)', () => {
      const day = new Date('2026-10-22T15:20:00.000Z');
      const { dayStart, dayEnd } = getDayUtcRange(day);

      expect(dayStart.toISOString()).toBe('2026-10-22T00:00:00.000Z');
      expect(dayEnd.toISOString()).toBe('2026-10-23T00:00:00.000Z');
      expect(dayEnd.getTime() - dayStart.getTime()).toBe(86_400_000);
    });
  });

  describe('Règle d’attribution des sessions (F-80)', () => {
    const targetDay = new Date('2026-10-22T00:00:00.000Z');

    it('sessions = nombre de sessionId distincts avec SESSION_START dans le compartiment de l’événement', () => {
      const events: StatsDailySourceEvent[] = [
        {
          occurredAt: new Date('2026-10-22T08:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 'session-alpha',
          type: EVENT_TYPES.SESSION_START,
        },
        {
          occurredAt: new Date('2026-10-22T08:05:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 'session-alpha', // doublon SESSION_START sur le même sessionId
          type: EVENT_TYPES.SESSION_START,
        },
        {
          occurredAt: new Date('2026-10-22T09:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 'session-beta', // second sessionId distinct
          type: EVENT_TYPES.SESSION_START,
        },
      ];

      const records = aggregateEventsForDay(events, targetDay);
      expect(records).toHaveLength(1);
      const row = records[0];
      expect(row).toBeDefined();
      if (row !== undefined) {
        expect(row.bucketKey).toBe(`${hotelA}:${tour1}:WEB:fr`);
        expect(row.sessions).toBe(2);
      }
    });

    it('sessionDurationMs = somme des durationMs des SESSION_END dans le compartiment de l’événement SESSION_END', () => {
      const events: StatsDailySourceEvent[] = [
        {
          occurredAt: new Date('2026-10-22T10:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-end-1',
          type: EVENT_TYPES.SESSION_END,
          durationMs: 45_000,
        },
        {
          occurredAt: new Date('2026-10-22T10:30:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-end-2',
          type: EVENT_TYPES.SESSION_END,
          durationMs: 65_000,
        },
        {
          occurredAt: new Date('2026-10-22T11:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-end-3',
          type: EVENT_TYPES.SESSION_END,
          durationMs: null, // durationMs nul ignoré
        },
        {
          occurredAt: new Date('2026-10-22T11:15:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-end-4',
          type: EVENT_TYPES.SESSION_END,
          durationMs: -5_000, // durationMs négatif ignoré
        },
      ];

      const records = aggregateEventsForDay(events, targetDay);
      expect(records).toHaveLength(1);
      const row = records[0];
      expect(row).toBeDefined();
      if (row !== undefined) {
        expect(row.sessionDurationMs).toBe(110_000n);
      }
    });

    it('un SESSION_START sans SESSION_END compte pour les sessions et pas pour la durée', () => {
      const events: StatsDailySourceEvent[] = [
        {
          occurredAt: new Date('2026-10-22T14:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'en',
          sessionId: 'session-start-only',
          type: EVENT_TYPES.SESSION_START,
        },
      ];

      const records = aggregateEventsForDay(events, targetDay);
      expect(records).toHaveLength(1);
      const row = records[0];
      expect(row).toBeDefined();
      if (row !== undefined) {
        expect(row.sessions).toBe(1);
        expect(row.sessionDurationMs).toBe(0n);
      }
    });

    it('un SESSION_END sans SESSION_START ajoute la durée mais pas de session', () => {
      const events: StatsDailySourceEvent[] = [
        {
          occurredAt: new Date('2026-10-22T15:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 'session-end-only',
          type: EVENT_TYPES.SESSION_END,
          durationMs: 75_000,
        },
      ];

      const records = aggregateEventsForDay(events, targetDay);
      expect(records).toHaveLength(1);
      const row = records[0];
      expect(row).toBeDefined();
      if (row !== undefined) {
        expect(row.sessions).toBe(0);
        expect(row.sessionDurationMs).toBe(75_000n);
      }
    });

    it('un même sessionId présent sur deux compartiments est compté une fois dans chacun', () => {
      const sharedSessionId = '01990000-0000-7000-8000-000000000999';
      const events: StatsDailySourceEvent[] = [
        // Visite tour1
        {
          occurredAt: new Date('2026-10-22T16:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: sharedSessionId,
          type: EVENT_TYPES.SESSION_START,
        },
        // Même sessionId sur la visite tour2 (ex. transition ou navigation inter-visites)
        {
          occurredAt: new Date('2026-10-22T16:10:00.000Z'),
          hotelId: hotelA,
          tourId: tour2,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: sharedSessionId,
          type: EVENT_TYPES.SESSION_START,
        },
      ];

      const records = aggregateEventsForDay(events, targetDay);
      expect(records).toHaveLength(2);

      const bucketTour1 = records.find(
        (r) => r.bucketKey === `${hotelA}:${tour1}:WEB:fr`,
      );
      expect(bucketTour1).toBeDefined();
      if (bucketTour1 !== undefined) {
        expect(bucketTour1.sessions).toBe(1);
        expect(bucketTour1.tourId).toBe(tour1);
      }

      const bucketTour2 = records.find(
        (r) => r.bucketKey === `${hotelA}:${tour2}:WEB:fr`,
      );
      expect(bucketTour2).toBeDefined();
      if (bucketTour2 !== undefined) {
        expect(bucketTour2.sessions).toBe(1);
        expect(bucketTour2.tourId).toBe(tour2);
      }
    });
  });

  describe('Groupement et compteurs d’interaction', () => {
    const targetDay = new Date('2026-10-22T00:00:00.000Z');

    it('retourne une liste vide lorsqu’il n’y a aucun événement', () => {
      const records = aggregateEventsForDay([], targetDay);
      expect(records).toEqual([]);
    });

    it('groupe correctement par hotelId, tourId, channel et lang', () => {
      const events: StatsDailySourceEvent[] = [
        // Compartiment 1 : hotelA, tour1, WEB, fr
        {
          occurredAt: new Date('2026-10-22T10:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's1',
          type: EVENT_TYPES.SESSION_START,
        },
        {
          occurredAt: new Date('2026-10-22T10:01:00.000Z'),
          hotelId: hotelA,
          tourId: tour1,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's1',
          type: EVENT_TYPES.TOUR_OPEN,
        },
        // Compartiment 2 : hotelA, tour2, KIOSK, ar
        {
          occurredAt: new Date('2026-10-22T11:00:00.000Z'),
          hotelId: hotelA,
          tourId: tour2,
          channel: EVENT_CHANNELS.KIOSK,
          lang: 'ar',
          sessionId: 's2',
          type: EVENT_TYPES.SESSION_START,
        },
        {
          occurredAt: new Date('2026-10-22T11:02:00.000Z'),
          hotelId: hotelA,
          tourId: tour2,
          channel: EVENT_CHANNELS.KIOSK,
          lang: 'ar',
          sessionId: 's2',
          type: EVENT_TYPES.SCENE_VIEW,
        },
        // Compartiment 3 : sans hôtel ni visite (VR, en)
        {
          occurredAt: new Date('2026-10-22T12:00:00.000Z'),
          hotelId: null,
          tourId: null,
          channel: EVENT_CHANNELS.VR,
          lang: 'en',
          sessionId: 's3',
          type: EVENT_TYPES.SESSION_START,
        },
      ];

      const records = aggregateEventsForDay(events, targetDay);
      expect(records).toHaveLength(3);

      const bucket1 = records.find(
        (r) => r.bucketKey === `${hotelA}:${tour1}:WEB:fr`,
      );
      expect(bucket1).toBeDefined();
      if (bucket1 !== undefined) {
        expect(bucket1.hotelId).toBe(hotelA);
        expect(bucket1.tourId).toBe(tour1);
        expect(bucket1.channel).toBe(EVENT_CHANNELS.WEB);
        expect(bucket1.lang).toBe('fr');
        expect(bucket1.sessions).toBe(1);
        expect(bucket1.toursOpened).toBe(1);
        expect(bucket1.scenesViewed).toBe(0);
      }

      const bucket2 = records.find(
        (r) => r.bucketKey === `${hotelA}:${tour2}:KIOSK:ar`,
      );
      expect(bucket2).toBeDefined();
      if (bucket2 !== undefined) {
        expect(bucket2.hotelId).toBe(hotelA);
        expect(bucket2.tourId).toBe(tour2);
        expect(bucket2.channel).toBe(EVENT_CHANNELS.KIOSK);
        expect(bucket2.lang).toBe('ar');
        expect(bucket2.sessions).toBe(1);
        expect(bucket2.toursOpened).toBe(0);
        expect(bucket2.scenesViewed).toBe(1);
      }

      const bucket3 = records.find(
        (r) => r.bucketKey === 'none:none:VR:en',
      );
      expect(bucket3).toBeDefined();
      if (bucket3 !== undefined) {
        expect(bucket3.hotelId).toBeNull();
        expect(bucket3.tourId).toBeNull();
        expect(bucket3.channel).toBe(EVENT_CHANNELS.VR);
        expect(bucket3.lang).toBe('en');
        expect(bucket3.sessions).toBe(1);
      }
    });

    it('cumule tous les types d’interaction demandés (hotspots, audio, vr, qr, tours, scènes)', () => {
      const events: StatsDailySourceEvent[] = [
        {
          occurredAt: new Date('2026-10-22T12:00:00.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.SESSION_START,
        },
        {
          occurredAt: new Date('2026-10-22T12:00:01.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.TOUR_OPEN,
        },
        {
          occurredAt: new Date('2026-10-22T12:00:02.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.SCENE_VIEW,
        },
        {
          occurredAt: new Date('2026-10-22T12:00:03.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.HOTSPOT_CLICK,
        },
        {
          occurredAt: new Date('2026-10-22T12:00:04.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.AUDIO_PLAY,
        },
        {
          occurredAt: new Date('2026-10-22T12:00:05.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.VR_ENTER,
        },
        {
          occurredAt: new Date('2026-10-22T12:00:06.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.QR_SHOWN,
        },
        {
          occurredAt: new Date('2026-10-22T12:00:07.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.VR_EXIT,
        },
        {
          occurredAt: new Date('2026-10-22T12:00:08.000Z'),
          hotelId: hotelB,
          tourId: tour1,
          channel: EVENT_CHANNELS.VR,
          lang: 'fr',
          sessionId: 's-full',
          type: EVENT_TYPES.LANG_CHANGE,
        },
      ];

      const records = aggregateEventsForDay(events, targetDay);
      expect(records).toHaveLength(1);
      const row = records[0];
      expect(row).toBeDefined();
      if (row !== undefined) {
        expect(row.sessions).toBe(1);
        expect(row.toursOpened).toBe(1);
        expect(row.scenesViewed).toBe(1);
        expect(row.hotspotClicks).toBe(1);
        expect(row.audioPlays).toBe(1);
        expect(row.vrEntries).toBe(1);
        expect(row.qrShown).toBe(1);
      }
    });
  });

  describe('Bornes UTC [00:00, 24:00)', () => {
    const targetDay = new Date('2026-10-22T00:00:00.000Z');

    it('inclut les événements exactement aux bornes inférieures et exclut les bornes externes', () => {
      const events: StatsDailySourceEvent[] = [
        // Juste avant la fenêtre (veille à 23:59:59.999Z) -> exclu
        {
          occurredAt: new Date('2026-10-21T23:59:59.999Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-prior',
          type: EVENT_TYPES.SESSION_START,
        },
        // Exactement à 00:00:00.000Z -> inclus
        {
          occurredAt: new Date('2026-10-22T00:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-start-exact',
          type: EVENT_TYPES.SESSION_START,
        },
        // En fin de journée à 23:59:59.999Z -> inclus
        {
          occurredAt: new Date('2026-10-22T23:59:59.999Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-end-exact',
          type: EVENT_TYPES.SESSION_START,
        },
        // Exactement à minuit le lendemain (24:00 / 00:00:00.000Z du jour suivant) -> exclu
        {
          occurredAt: new Date('2026-10-23T00:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-next',
          type: EVENT_TYPES.SESSION_START,
        },
      ];

      const records = aggregateEventsForDay(events, targetDay);
      expect(records).toHaveLength(1);
      const row = records[0];
      expect(row).toBeDefined();
      if (row !== undefined) {
        expect(row.sessions).toBe(2); // 's-start-exact' et 's-end-exact'
      }
    });
  });

  describe('Non-mutation des événements', () => {
    const targetDay = new Date('2026-10-22T00:00:00.000Z');

    it('ne modifie jamais les événements bruts reçus en entrée', () => {
      const rawEvent: StatsDailySourceEvent = {
        occurredAt: new Date('2026-10-22T15:00:00.000Z'),
        hotelId: hotelA,
        tourId: tour1,
        channel: EVENT_CHANNELS.WEB,
        lang: 'fr',
        sessionId: 'freeze-session',
        type: EVENT_TYPES.SESSION_START,
        durationMs: 12_000,
      };
      Object.freeze(rawEvent);

      const events: readonly StatsDailySourceEvent[] = Object.freeze([rawEvent]);

      expect(() => {
        const records = aggregateEventsForDay(events, targetDay);
        expect(records).toHaveLength(1);
      }).not.toThrow();

      expect(rawEvent.sessionId).toBe('freeze-session');
      expect(rawEvent.type).toBe(EVENT_TYPES.SESSION_START);
      expect(rawEvent.durationMs).toBe(12_000);
    });
  });
});
