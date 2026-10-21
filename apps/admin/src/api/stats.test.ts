import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from './client.js';
import { downloadStatsCsv, getStats, type StatsQuery } from './stats.js';

const query: StatsQuery = { from: '2026-10-01', to: '2026-10-07', hotelId: 'hotel-id', tourId: 'tour-id', channel: 'KIOSK', lang: 'fr' };

describe('API statistiques', () => {
  afterEach(() => { vi.unstubAllGlobals(); clearCsrfToken(); });

  it('lit le tableau de bord avec les filtres encodés et les dates UTC', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, dashboard));
    vi.stubGlobal('fetch', fetchMock);
    await getStats(query);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/admin/stats');
    expect(url.searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(url.searchParams.get('to')).toBe('2026-10-08T00:00:00.000Z');
    expect(url.searchParams.get('hotelId')).toBe('hotel-id');
    expect(url.searchParams.get('channel')).toBe('KIOSK');
  });

  it('récupère le CSV comme blob', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('\uFEFF"Indicateur";"Valeur"'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await downloadStatsCsv(query);
    expect(result.type).toBe('text/plain;charset=utf-8');
    expect(await result.text()).toContain('Indicateur');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/stats/export.csv?');
  });
});

const dashboard = {
  summary: { sessions: 2, averageSessionDurationMs: 30000, toursOpened: 2, scenesViewed: 4, hotspotClicks: 1, vrEntries: 0, qrScans: 1 },
  daily: [], hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: 0 })),
  topTours: [], topScenes: [], languages: [], channels: [],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
