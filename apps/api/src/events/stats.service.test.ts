import { EVENT_CHANNELS, Role } from '@xplor/shared';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StatsService, type StatsPrismaClient } from './stats.service.js';

const from = new Date('2026-10-01T00:00:00.000Z');
const to = new Date('2026-10-08T00:00:00.000Z');
const admin = { userId: 'admin', role: Role.ADMIN, hotelIds: [] };
const manager = { userId: 'manager', role: Role.HOTEL_MANAGER, hotelIds: ['10000000-0000-7000-8000-000000000001'] };

function mockDb(results: unknown[] = []): StatsPrismaClient & { $queryRaw: ReturnType<typeof vi.fn> } {
  return { $queryRaw: vi.fn().mockImplementation(() => Promise.resolve(results.shift() ?? [])) };
}

describe('StatsService (M7 F-81/F-82)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns summary, daily/hourly series and top lists with normalized numbers', async () => {
    const db = mockDb([
      [{ sessions: 3n, averageSessionDurationMs: 90000n, toursOpened: 4n, scenesViewed: 8n, hotspotClicks: 2n, vrEntries: 1n, qrScans: 5n }],
      [{ key: '2026-10-01', sessions: 3n, toursOpened: 4n, scenesViewed: 8n }],
      [{ key: 9, sessions: 3n }],
      [{ key: 'tour-id', label: 'Tour', count: 4n }],
      [{ key: 'scene-id', label: 'Scene', count: 8n }],
      [{ key: 'fr', count: 3n }],
      [{ key: EVENT_CHANNELS.WEB, count: 3n }],
    ]);
    const service = new StatsService(db);
    const result = await service.dashboard(admin, { from, to, channel: 'WEB' });

    expect(result.summary).toEqual({ sessions: 3, averageSessionDurationMs: 90000, toursOpened: 4, scenesViewed: 8, hotspotClicks: 2, vrEntries: 1, qrScans: 5 });
    expect(result.daily).toEqual([{ day: '2026-10-01', sessions: 3, toursOpened: 4, scenesViewed: 8 }]);
    expect(result.hourly).toHaveLength(24);
    expect(result.hourly[9]).toEqual({ hour: 9, sessions: 3 });
    expect(result.topTours).toEqual([{ id: 'tour-id', label: 'Tour', opens: 4 }]);
    expect(result.topScenes).toEqual([{ id: 'scene-id', label: 'Scene', views: 8 }]);
    expect(db.$queryRaw.mock.calls).toHaveLength(7);
  });

  it('scopes a hotel manager to assigned hotels even when no hotel filter is sent', async () => {
    const db = mockDb([[], [], [], [], [], [], []]);
    const service = new StatsService(db);
    await service.dashboard(manager, { from, to });
    const query = db.$queryRaw.mock.calls[0]?.[0] as { sql?: string; values?: unknown[] };
    expect(query.sql).toContain('"hotelId" IN');
    expect(query.values).toContain(manager.hotelIds[0]);
  });

  it('refuses an explicit hotel outside the manager scope without querying', async () => {
    const db = mockDb();
    const service = new StatsService(db);
    await expect(service.dashboard(manager, { from, to, hotelId: '10000000-0000-7000-8000-000000000002' })).rejects.toBeInstanceOf(NotFoundException);
    expect(db.$queryRaw.mock.calls).toHaveLength(0);
  });

  it('refuses an editor with no hotel scope', async () => {
    const db = mockDb();
    const service = new StatsService(db);
    await expect(service.dashboard({ userId: 'editor', role: Role.EDITOR, hotelIds: [] }, { from, to })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.$queryRaw.mock.calls).toHaveLength(0);
  });

  it('exports UTF-8 BOM, semicolon separated rows, and protects spreadsheet formulas', async () => {
    const db = mockDb([
      [{ sessions: 1, averageSessionDurationMs: 0, toursOpened: 1, scenesViewed: 0, hotspotClicks: 0, vrEntries: 0, qrScans: 0 }],
      [], [], [{ key: 'tour', label: '=SUM(A1:A2)', count: 1 }], [], [], [],
    ]);
    const csv = await new StatsService(db).exportCsv(admin, { from, to });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Indicateur";"Valeur"');
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain('\r\n');
  });

  it('rejects periods over one year', async () => {
    const db = mockDb();
    const service = new StatsService(db);
    await expect(service.dashboard(admin, { from, to: new Date('2028-01-01T00:00:00.000Z') })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$queryRaw.mock.calls).toHaveLength(0);
  });
});
