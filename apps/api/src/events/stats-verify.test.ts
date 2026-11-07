import { describe, expect, it, vi } from 'vitest';
import {
  computeDemoSessionIds,
  runStatsVerify,
  type VerifyDb,
} from '../../prisma/stats-verify.js';

describe('stats-verify (M7 F-81 / F-82)', () => {
  it('computeDemoSessionIds génère 84 identifiants de session déterministes sur 7 jours', () => {
    const now = new Date('2026-10-21T12:00:00.000Z');
    const ids = computeDemoSessionIds(now);
    expect(ids).toHaveLength(84);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(84);
    const repeated = computeDemoSessionIds(now);
    expect(ids).toEqual(repeated);
  });

  it('cas jeu de démo absent : log un message explicatif et retourne demoPresent=false, ok=false', async () => {
    const logs: string[] = [];
    const mockDb: VerifyDb = {
      event: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    };

    const result = await runStatsVerify(mockDb, new Date(), (msg: string): void => {
      logs.push(msg);
    });

    expect(result).toEqual({ ok: false, demoPresent: false });
    expect(logs.some((l) => l.includes('Jeu de démo absent'))).toBe(true);
    expect(logs.some((l) => l.includes('pnpm --filter @xplor/api stats:demo -- --confirm-dev'))).toBe(true);
  });

  it('cas cohérent : valide le jeu de démo et effectue les trois affichages séparés', async () => {
    const logs: string[] = [];
    const mockDb: VerifyDb = {
      event: {
        count: vi.fn().mockImplementation((args?: { where?: { sessionId?: unknown; hotelId?: string; occurredAt?: unknown } }) => {
          if (args?.where?.sessionId !== undefined) {
            return Promise.resolve(418); // demoCount
          }
          if (args?.where?.hotelId === 'hotel-1') {
            return Promise.resolve(418);
          }
          if (args?.where?.occurredAt !== undefined) {
            return Promise.resolve(418);
          }
          return Promise.resolve(418); // total
        }),
        groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
          if (args.by.includes('sessionId')) {
            return Promise.resolve(Array.from({ length: 84 }, (_, i) => ({ sessionId: `session-${String(i)}` })));
          }
          if (args.by.includes('channel')) {
            return Promise.resolve([
              { channel: 'WEB', _count: { _all: 140 } },
              { channel: 'KIOSK', _count: { _all: 140 } },
              { channel: 'VR', _count: { _all: 138 } },
            ]);
          }
          if (args.by.includes('lang')) {
            return Promise.resolve([
              { lang: 'fr', _count: { _all: 200 } },
              { lang: 'ar', _count: { _all: 118 } },
              { lang: 'en', _count: { _all: 100 } },
            ]);
          }
          if (args.by.includes('hotelId')) {
            return Promise.resolve([
              { hotelId: 'hotel-1', _count: { _all: 418 } },
            ]);
          }
          if (args.by.includes('tourId')) {
            return Promise.resolve([
              { tourId: 'tour-1', _count: { _all: 418 } },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
    };

    const result = await runStatsVerify(mockDb, new Date('2026-10-21T12:00:00.000Z'), (msg: string): void => {
      logs.push(msg);
    });

    expect(result).toEqual({ ok: true, demoPresent: true });
    expect(logs.some((l) => l.includes('--- Totaux filtrés par hôtel ---'))).toBe(true);
    expect(logs.some((l) => l.includes('--- Totaux filtrés par visite ---'))).toBe(true);
    expect(logs.some((l) => l.includes('--- Totaux sur les 7 derniers jours ---'))).toBe(true);
    expect(logs.some((l) => l.includes('Cohérence statistique validée'))).toBe(true);
  });

  it('cas incohérent : détecte un écart de somme, affiche les erreurs et retourne ok=false', async () => {
    const logs: string[] = [];
    const mockDb: VerifyDb = {
      event: {
        count: vi.fn().mockResolvedValue(100),
        groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
          if (args.by.includes('sessionId')) {
            return Promise.resolve([{ sessionId: 's1' }]);
          }
          if (args.by.includes('channel')) {
            return Promise.resolve([
              { channel: 'WEB', _count: { _all: 50 } }, // 50 au lieu de 100
            ]);
          }
          if (args.by.includes('lang')) {
            return Promise.resolve([
              { lang: 'fr', _count: { _all: 100 } },
            ]);
          }
          if (args.by.includes('hotelId')) {
            return Promise.resolve([
              { hotelId: 'hotel-1', _count: { _all: 100 } },
            ]);
          }
          if (args.by.includes('tourId')) {
            return Promise.resolve([
              { tourId: 'tour-1', _count: { _all: 100 } },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
    };

    const result = await runStatsVerify(mockDb, new Date(), (msg: string): void => {
      logs.push(msg);
    });

    expect(result).toEqual({ ok: false, demoPresent: true });
    expect(logs.some((l) => l.includes('Erreur de cohérence'))).toBe(true);
    expect(logs.some((l) => l.includes('Écart canal'))).toBe(true);
  });

  it('cas groupe hotelId null : passe allEventsHaveHotel=false à checkStatsConsistency', async () => {
    const logs: string[] = [];
    const mockDb: VerifyDb = {
      event: {
        count: vi.fn().mockResolvedValue(100),
        groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
          if (args.by.includes('sessionId')) {
            return Promise.resolve([{ sessionId: 's1' }]);
          }
          if (args.by.includes('channel')) {
            return Promise.resolve([
              { channel: 'WEB', _count: { _all: 100 } },
            ]);
          }
          if (args.by.includes('lang')) {
            return Promise.resolve([
              { lang: 'fr', _count: { _all: 100 } },
            ]);
          }
          if (args.by.includes('hotelId')) {
            // Un groupe avec hotelId null (événement sans hôtel) et un avec hotel-1
            return Promise.resolve([
              { hotelId: null, _count: { _all: 40 } },
              { hotelId: 'hotel-1', _count: { _all: 60 } },
            ]);
          }
          if (args.by.includes('tourId')) {
            return Promise.resolve([
              { tourId: null, _count: { _all: 100 } },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
    };

    // Avec allEventsHaveHotel=false, somme(hotels) = 60 <= 100 est valide
    const result = await runStatsVerify(mockDb, new Date(), (msg: string): void => {
      logs.push(msg);
    });

    expect(result).toEqual({ ok: true, demoPresent: true });
    expect(logs.some((l) => l.includes('Cohérence statistique validée'))).toBe(true);
  });
});
