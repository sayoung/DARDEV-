import { describe, expect, it, vi } from 'vitest';
import { Role } from '@xplor/shared';
import {
  PrismaHotelMonthlyReportRepository,
  resolveHotelReportRecipients,
  type HotelMonthlyReportPrismaClient,
  type HotelWithManagers,
  type RawStatsDailyRow,
  type RawEventRow,
} from './hotel-monthly-report-repository.js';

describe('hotel-monthly-report-repository (F-83)', () => {
  const hotelIdA = '01990000-0000-7000-8000-000000000001';
  const hotelIdB = '01990000-0000-7000-8000-000000000002';
  const tourId1 = '01990000-0000-7000-8000-000000000010';
  const tourId2 = '01990000-0000-7000-8000-000000000011';
  const sceneId1 = '01990000-0000-7000-8000-000000000020';
  const sceneId2 = '01990000-0000-7000-8000-000000000021';

  describe('resolveHotelReportRecipients', () => {
    it('renvoie un tableau vide si l hôtel est inactif ou supprimé', () => {
      const inactiveHotel: HotelWithManagers = {
        id: hotelIdA,
        name: 'Hôtel Inactif',
        email: 'contact@inactif.local',
        active: false,
        deletedAt: null,
        languages: ['fr'],
        managers: [],
      };
      expect(resolveHotelReportRecipients(inactiveHotel)).toEqual([]);

      const deletedHotel: HotelWithManagers = {
        ...inactiveHotel,
        active: true,
        deletedAt: new Date(),
      };
      expect(resolveHotelReportRecipients(deletedHotel)).toEqual([]);
    });

    it('collecte l email de l hôtel et les gestionnaires actifs', () => {
      const hotel: HotelWithManagers = {
        id: hotelIdA,
        name: 'Hôtel Palace',
        email: 'info@palace.local',
        active: true,
        deletedAt: null,
        languages: ['fr', 'en'],
        managers: [
          {
            user: {
              id: '01990000-0000-7000-8000-000000000030',
              name: 'Karim Gestionnaire',
              email: 'karim@palace.local',
              active: true,
              role: Role.HOTEL_MANAGER,
              uiLang: 'fr',
            },
          },
        ],
      };

      const recipients = resolveHotelReportRecipients(hotel);
      expect(recipients).toHaveLength(2);
      expect(recipients).toEqual([
        { email: 'karim@palace.local', name: 'Karim Gestionnaire', lang: 'fr' },
        { email: 'info@palace.local', name: 'Hôtel Palace', lang: 'fr' },
      ]);
    });

    it('ignore les gestionnaires inactifs ou d autres rôles, et dédoublonne les adresses identiques', () => {
      const hotel: HotelWithManagers = {
        id: hotelIdA,
        name: 'Hôtel Mixte',
        email: 'direction@mixte.local',
        active: true,
        deletedAt: null,
        languages: ['en'],
        managers: [
          {
            user: {
              id: '01990000-0000-7000-8000-000000000031',
              name: 'Manager Inactif',
              email: 'inactif@mixte.local',
              active: false,
              role: Role.HOTEL_MANAGER,
              uiLang: 'en',
            },
          },
          {
            user: {
              id: '01990000-0000-7000-8000-000000000032',
              name: 'Admin User',
              email: 'admin@mixte.local',
              active: true,
              role: Role.ADMIN, // Doit être ignoré, seul HOTEL_MANAGER est retenu
              uiLang: 'fr',
            },
          },
          {
            user: {
              id: '01990000-0000-7000-8000-000000000033',
              name: 'Directeur',
              email: 'DIRECTION@mixte.local', // Casse différente, doit être dédoublonnée avec hotel.email
              active: true,
              role: Role.HOTEL_MANAGER,
              uiLang: 'en',
            },
          },
        ],
      };

      const recipients = resolveHotelReportRecipients(hotel);
      expect(recipients).toHaveLength(1);
      const recipient = recipients[0];
      expect(recipient?.email).toBe('direction@mixte.local');
      expect(recipient?.lang).toBe('en');
    });

    it('garantit une isolation stricte des destinataires entre hôtels distincts', () => {
      const hotelA: HotelWithManagers = {
        id: hotelIdA,
        name: 'Hôtel A',
        email: 'contact@hotel-a.local',
        active: true,
        deletedAt: null,
        languages: ['fr'],
        managers: [
          {
            user: {
              id: '01990000-0000-7000-8000-000000000040',
              name: 'Gestionnaire A',
              email: 'manager-a@hotel-a.local',
              active: true,
              role: Role.HOTEL_MANAGER,
              uiLang: 'fr',
            },
          },
        ],
      };

      const hotelB: HotelWithManagers = {
        id: hotelIdB,
        name: 'Hôtel B',
        email: 'contact@hotel-b.local',
        active: true,
        deletedAt: null,
        languages: ['en'],
        managers: [
          {
            user: {
              id: '01990000-0000-7000-8000-000000000041',
              name: 'Gestionnaire B',
              email: 'manager-b@hotel-b.local',
              active: true,
              role: Role.HOTEL_MANAGER,
              uiLang: 'en',
            },
          },
        ],
      };

      const recipientsA = resolveHotelReportRecipients(hotelA);
      const recipientsB = resolveHotelReportRecipients(hotelB);

      // Aucun destinataire de B ne doit figurer dans A, et réciproquement
      expect(recipientsA.some((r) => r.email.includes('hotel-b'))).toBe(false);
      expect(recipientsB.some((r) => r.email.includes('hotel-a'))).toBe(false);
      expect(recipientsA).toEqual([
        { email: 'manager-a@hotel-a.local', name: 'Gestionnaire A', lang: 'fr' },
        { email: 'contact@hotel-a.local', name: 'Hôtel A', lang: 'fr' },
      ]);
      expect(recipientsB).toEqual([
        { email: 'manager-b@hotel-b.local', name: 'Gestionnaire B', lang: 'en' },
        { email: 'contact@hotel-b.local', name: 'Hôtel B', lang: 'en' },
      ]);
    });
  });

  describe('PrismaHotelMonthlyReportRepository — Isolation stricte entre hôtels', () => {
    it('liste les hôtels actifs et exclut les hôtels inactifs ou supprimés', async () => {
      const mockHotelFindMany = vi.fn().mockResolvedValue([
        {
          id: hotelIdA,
          name: 'Hôtel A',
          email: 'contact@hotel-a.local',
          active: true,
          deletedAt: null,
          languages: ['fr'],
          managers: [],
        },
      ]);

      const mockPrisma: HotelMonthlyReportPrismaClient = {
        hotel: { findMany: mockHotelFindMany },
        statsDaily: { findMany: vi.fn().mockResolvedValue([]) },
        event: { findMany: vi.fn().mockResolvedValue([]) },
        tour: { findMany: vi.fn().mockResolvedValue([]) },
        scene: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const repo = new PrismaHotelMonthlyReportRepository(mockPrisma);
      const hotels = await repo.listActiveHotels();

      expect(mockHotelFindMany).toHaveBeenCalledWith({
        where: { active: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          deletedAt: true,
          languages: true,
          managers: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  active: true,
                  role: true,
                  uiLang: true,
                },
              },
            },
          },
        },
      });
      expect(hotels).toHaveLength(1);
      const firstHotel = hotels[0];
      expect(firstHotel?.id).toBe(hotelIdA);
    });

    it('garantit que le rapport de l hôtel A ne contient QUE les données de l hôtel A (StatsDaily)', async () => {
      const mockStatsDailyFindMany = vi.fn().mockImplementation((args: { where: { hotelId: string } }) => {
        if (args.where.hotelId === hotelIdA) {
          const rowsA: RawStatsDailyRow[] = [
            {
              hotelId: hotelIdA,
              tourId: tourId1,
              channel: 'KIOSK',
              lang: 'fr',
              sessions: 50,
              toursOpened: 40,
              scenesViewed: 150,
              hotspotClicks: 30,
              audioPlays: 10,
              vrEntries: 5,
              qrShown: 8,
              sessionDurationMs: 6_000_000n, // 50 sessions * 120s
            },
          ];
          return Promise.resolve(rowsA);
        }
        if (args.where.hotelId === hotelIdB) {
          const rowsB: RawStatsDailyRow[] = [
            {
              hotelId: hotelIdB,
              tourId: tourId2,
              channel: 'WEB',
              lang: 'en',
              sessions: 999,
              toursOpened: 888,
              scenesViewed: 777,
              hotspotClicks: 666,
              audioPlays: 555,
              vrEntries: 444,
              qrShown: 333,
              sessionDurationMs: 999_000_000n,
            },
          ];
          return Promise.resolve(rowsB);
        }
        return Promise.resolve([]);
      });

      const mockEventFindMany = vi.fn().mockResolvedValue([]);
      const mockTourFindMany = vi.fn().mockResolvedValue([
        { id: tourId1, title: { fr: 'Visite Hôtel A' } },
        { id: tourId2, title: { fr: 'Visite Hôtel B' } },
      ]);
      const mockSceneFindMany = vi.fn().mockResolvedValue([]);
      const mockHotelFindMany = vi.fn().mockResolvedValue([]);

      const mockPrisma: HotelMonthlyReportPrismaClient = {
        hotel: { findMany: mockHotelFindMany },
        statsDaily: { findMany: mockStatsDailyFindMany },
        event: { findMany: mockEventFindMany },
        tour: { findMany: mockTourFindMany },
        scene: { findMany: mockSceneFindMany },
      };

      const repo = new PrismaHotelMonthlyReportRepository(mockPrisma);
      const from = new Date('2026-10-01T00:00:00.000Z');
      const to = new Date('2026-11-01T00:00:00.000Z');

      const reportA = await repo.getHotelMonthlyReportData(hotelIdA, 'Hôtel A', from, to, 'fr');

      // Vérifie l'isolation stricte : aucune statistique de l'hôtel B n'apparaît
      expect(reportA.hotelId).toBe(hotelIdA);
      expect(reportA.summary.sessions).toBe(50);
      expect(reportA.summary.toursOpened).toBe(40);
      expect(reportA.summary.scenesViewed).toBe(150);
      expect(reportA.summary.hotspotClicks).toBe(30);
      expect(reportA.summary.vrEntries).toBe(5);
      expect(reportA.summary.qrScans).toBe(8);
      expect(reportA.summary.averageSessionDurationMs).toBe(120_000);
      expect(reportA.summary.sessions).not.toBe(999);
      expect(reportA.topTours).toHaveLength(1);
      const firstTour = reportA.topTours[0];
      expect(firstTour?.label).toBe('Visite Hôtel A');
      expect(reportA.channels).toEqual([{ channel: 'KIOSK', sessions: 50 }]);
      expect(reportA.languages).toEqual([{ lang: 'fr', sessions: 50 }]);

      // Vérifie que l'appel a bien ciblé hotelIdA exclusivement
      expect(mockStatsDailyFindMany).toHaveBeenCalledWith({
        where: { hotelId: hotelIdA, day: { gte: from, lt: to } },
      });
      expect(mockEventFindMany).toHaveBeenCalledWith({
        where: { hotelId: hotelIdA, occurredAt: { gte: from, lt: to } },
        select: {
          type: true,
          sessionId: true,
          durationMs: true,
          tourId: true,
          sceneId: true,
          lang: true,
          channel: true,
        },
      });
    });

    it('garantit réciproquement que le rapport de l hôtel B ne contient QUE les données de l hôtel B', async () => {
      const mockStatsDailyFindMany = vi.fn().mockImplementation((args: { where: { hotelId: string } }) => {
        if (args.where.hotelId === hotelIdB) {
          const rowsB: RawStatsDailyRow[] = [
            {
              hotelId: hotelIdB,
              tourId: tourId2,
              channel: 'WEB',
              lang: 'fr',
              sessions: 25,
              toursOpened: 20,
              scenesViewed: 80,
              hotspotClicks: 15,
              audioPlays: 5,
              vrEntries: 2,
              qrShown: 4,
              sessionDurationMs: 2_500_000n, // 100s en moyenne
            },
          ];
          return Promise.resolve(rowsB);
        }
        return Promise.resolve([]);
      });

      const mockEventFindMany = vi.fn().mockResolvedValue([]);
      const mockTourFindMany = vi.fn().mockResolvedValue([
        { id: tourId2, title: { fr: 'Visite Hôtel B' } },
      ]);
      const mockSceneFindMany = vi.fn().mockResolvedValue([]);
      const mockHotelFindMany = vi.fn().mockResolvedValue([]);

      const mockPrisma: HotelMonthlyReportPrismaClient = {
        hotel: { findMany: mockHotelFindMany },
        statsDaily: { findMany: mockStatsDailyFindMany },
        event: { findMany: mockEventFindMany },
        tour: { findMany: mockTourFindMany },
        scene: { findMany: mockSceneFindMany },
      };

      const repo = new PrismaHotelMonthlyReportRepository(mockPrisma);
      const from = new Date('2026-10-01T00:00:00.000Z');
      const to = new Date('2026-11-01T00:00:00.000Z');

      const reportB = await repo.getHotelMonthlyReportData(hotelIdB, 'Hôtel B', from, to, 'fr');

      expect(reportB.hotelId).toBe(hotelIdB);
      expect(reportB.summary.sessions).toBe(25);
      expect(reportB.summary.toursOpened).toBe(20);
      expect(reportB.summary.scenesViewed).toBe(80);
      expect(reportB.summary.averageSessionDurationMs).toBe(100_000);
      expect(reportB.topTours).toEqual([{ id: tourId2, label: 'Visite Hôtel B', opens: 20 }]);
      expect(reportB.channels).toEqual([{ channel: 'WEB', sessions: 25 }]);
    });

    it('agrège fidèlement depuis Event en cas d absence de StatsDaily pour l hôtel', async () => {
      const mockStatsDailyFindMany = vi.fn().mockResolvedValue([]);
      const mockEventFindMany = vi.fn().mockImplementation((args: { where: { hotelId: string } }) => {
        if (args.where.hotelId === hotelIdA) {
          const events: RawEventRow[] = [
            {
              type: 'SESSION_START',
              sessionId: '01990000-0000-7000-8000-000000000100',
              tourId: null,
              sceneId: null,
              lang: 'fr',
              channel: 'KIOSK',
            },
            {
              type: 'TOUR_OPEN',
              sessionId: '01990000-0000-7000-8000-000000000100',
              tourId: tourId1,
              sceneId: null,
              lang: 'fr',
              channel: 'KIOSK',
            },
            {
              type: 'SCENE_VIEW',
              sessionId: '01990000-0000-7000-8000-000000000100',
              tourId: tourId1,
              sceneId: sceneId1,
              lang: 'fr',
              channel: 'KIOSK',
            },
            {
              type: 'HOTSPOT_CLICK',
              sessionId: '01990000-0000-7000-8000-000000000100',
              tourId: tourId1,
              sceneId: sceneId1,
              lang: 'fr',
              channel: 'KIOSK',
            },
            {
              type: 'VR_ENTER',
              sessionId: '01990000-0000-7000-8000-000000000100',
              tourId: tourId1,
              sceneId: sceneId1,
              lang: 'fr',
              channel: 'KIOSK',
            },
            {
              type: 'QR_SHOWN',
              sessionId: '01990000-0000-7000-8000-000000000100',
              tourId: tourId1,
              sceneId: sceneId1,
              lang: 'fr',
              channel: 'KIOSK',
            },
            {
              type: 'SESSION_END',
              sessionId: '01990000-0000-7000-8000-000000000100',
              durationMs: 120_000,
              tourId: null,
              sceneId: null,
              lang: 'fr',
              channel: 'KIOSK',
            },
          ];
          return Promise.resolve(events);
        }
        return Promise.resolve([]);
      });

      const mockTourFindMany = vi.fn().mockResolvedValue([
        { id: tourId1, title: { fr: 'Kasbah' } },
      ]);
      const mockSceneFindMany = vi.fn().mockResolvedValue([
        { id: sceneId1, title: { fr: 'Bab Oudaya' } },
      ]);
      const mockHotelFindMany = vi.fn().mockResolvedValue([]);

      const mockPrisma: HotelMonthlyReportPrismaClient = {
        hotel: { findMany: mockHotelFindMany },
        statsDaily: { findMany: mockStatsDailyFindMany },
        event: { findMany: mockEventFindMany },
        tour: { findMany: mockTourFindMany },
        scene: { findMany: mockSceneFindMany },
      };

      const repo = new PrismaHotelMonthlyReportRepository(mockPrisma);
      const from = new Date('2026-10-01T00:00:00.000Z');
      const to = new Date('2026-11-01T00:00:00.000Z');

      const report = await repo.getHotelMonthlyReportData(hotelIdA, 'Hôtel A', from, to, 'fr');

      expect(report.summary.sessions).toBe(1);
      expect(report.summary.toursOpened).toBe(1);
      expect(report.summary.scenesViewed).toBe(1);
      expect(report.summary.hotspotClicks).toBe(1);
      expect(report.summary.vrEntries).toBe(1);
      expect(report.summary.qrScans).toBe(1);
      expect(report.summary.averageSessionDurationMs).toBe(120_000);
      expect(report.topTours).toEqual([{ id: tourId1, label: 'Kasbah', opens: 1 }]);
      expect(report.topScenes).toEqual([{ id: sceneId1, label: 'Bab Oudaya', views: 1 }]);
      expect(report.channels).toEqual([{ channel: 'KIOSK', sessions: 1 }]);
      expect(report.languages).toEqual([{ lang: 'fr', sessions: 1 }]);
    });

    it('corrige le surcomptage possible des sessions StatsDaily lorsqu une même session est présente sur plusieurs compartiments ou visites', async () => {
      // Cas typique où StatsDaily a 2 compartiments distincts (ex. tour 1 et tour 2)
      // dans lesquels le même visiteur est comptabilisé (somme brute = 2)
      const mockStatsDailyFindMany = vi.fn().mockResolvedValue([
        {
          hotelId: hotelIdA,
          tourId: tourId1,
          channel: 'KIOSK',
          lang: 'fr',
          sessions: 1,
          toursOpened: 1,
          scenesViewed: 2,
          hotspotClicks: 1,
          audioPlays: 0,
          vrEntries: 0,
          qrShown: 0,
          sessionDurationMs: 60_000n,
        },
        {
          hotelId: hotelIdA,
          tourId: tourId2,
          channel: 'KIOSK',
          lang: 'fr',
          sessions: 1,
          toursOpened: 1,
          scenesViewed: 3,
          hotspotClicks: 2,
          audioPlays: 0,
          vrEntries: 0,
          qrShown: 0,
          sessionDurationMs: 60_000n,
        },
      ]);

      const sharedSessionId = '01990000-0000-7000-8000-000000000888';
      const mockEventFindMany = vi.fn().mockResolvedValue([
        {
          type: 'SESSION_START',
          sessionId: sharedSessionId,
          tourId: tourId1,
          sceneId: null,
          lang: 'fr',
          channel: 'KIOSK',
        },
        {
          type: 'SESSION_START',
          sessionId: sharedSessionId,
          tourId: tourId2,
          sceneId: null,
          lang: 'fr',
          channel: 'KIOSK',
        },
        {
          type: 'SCENE_VIEW',
          sessionId: sharedSessionId,
          tourId: tourId1,
          sceneId: sceneId1,
          lang: 'fr',
          channel: 'KIOSK',
        },
        {
          type: 'SCENE_VIEW',
          sessionId: sharedSessionId,
          tourId: tourId2,
          sceneId: sceneId2,
          lang: 'fr',
          channel: 'KIOSK',
        },
      ]);

      const mockTourFindMany = vi.fn().mockResolvedValue([
        { id: tourId1, title: { fr: 'Visite 1' } },
        { id: tourId2, title: { fr: 'Visite 2' } },
      ]);
      const mockSceneFindMany = vi.fn().mockResolvedValue([
        { id: sceneId1, title: { fr: 'Scène 1' } },
        { id: sceneId2, title: { fr: 'Scène 2' } },
      ]);

      const mockPrisma: HotelMonthlyReportPrismaClient = {
        hotel: { findMany: vi.fn().mockResolvedValue([]) },
        statsDaily: { findMany: mockStatsDailyFindMany },
        event: { findMany: mockEventFindMany },
        tour: { findMany: mockTourFindMany },
        scene: { findMany: mockSceneFindMany },
      };

      const repo = new PrismaHotelMonthlyReportRepository(mockPrisma);
      const from = new Date('2026-10-01T00:00:00.000Z');
      const to = new Date('2026-11-01T00:00:00.000Z');

      const report = await repo.getHotelMonthlyReportData(hotelIdA, 'Hôtel A', from, to, 'fr');

      // La somme brute de StatsDaily donnerait 2 sessions (1 + 1).
      // Le dédoublonnage par sessionId corrige ce surcomptage : exactement 1 session réelle.
      expect(report.summary.sessions).toBe(1);
      expect(report.channels).toEqual([{ channel: 'KIOSK', sessions: 1 }]);
      expect(report.languages).toEqual([{ lang: 'fr', sessions: 1 }]);
      // Les compteurs d'action et durées sont bien cumulés depuis StatsDaily
      expect(report.summary.toursOpened).toBe(2);
      expect(report.summary.scenesViewed).toBe(5);
      expect(report.summary.hotspotClicks).toBe(3);
      expect(report.summary.averageSessionDurationMs).toBe(120_000); // 120_000 / 1 session
      expect(report.topScenes).toHaveLength(2);
    });

    it('gère correctement un mois sans aucune activité (0 session, 0 interaction)', async () => {
      const mockPrisma: HotelMonthlyReportPrismaClient = {
        hotel: { findMany: vi.fn().mockResolvedValue([]) },
        statsDaily: { findMany: vi.fn().mockResolvedValue([]) },
        event: { findMany: vi.fn().mockResolvedValue([]) },
        tour: { findMany: vi.fn().mockResolvedValue([]) },
        scene: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const repo = new PrismaHotelMonthlyReportRepository(mockPrisma);
      const from = new Date('2026-10-01T00:00:00.000Z');
      const to = new Date('2026-11-01T00:00:00.000Z');

      const report = await repo.getHotelMonthlyReportData(hotelIdA, 'Hôtel A', from, to, 'fr');

      expect(report.hotelId).toBe(hotelIdA);
      expect(report.summary.sessions).toBe(0);
      expect(report.summary.averageSessionDurationMs).toBe(0);
      expect(report.summary.toursOpened).toBe(0);
      expect(report.summary.scenesViewed).toBe(0);
      expect(report.topTours).toEqual([]);
      expect(report.topScenes).toEqual([]);
      expect(report.languages).toEqual([]);
      expect(report.channels).toEqual([]);
    });
  });
});
