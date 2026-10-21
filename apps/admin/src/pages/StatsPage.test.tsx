import { cleanup, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App.js';
import { clearCsrfToken } from '../api/client.js';
import { i18n } from '../i18n.js';

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('StatsPage (M7 F-81)', () => {
  beforeEach(async () => {
    clearCsrfToken();
    window.history.replaceState(null, '', '/stats?lang=fr');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, { id: 'admin', email: 'admin@example.test', name: 'Admin', role: Role.ADMIN, uiLang: 'fr', csrfToken: 'csrf' }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/admin/stats?')) return Promise.resolve(jsonResponse(200, stats));
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('affiche les indicateurs, graphiques, filtres et export CSV', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: resources.fr.page.stats.title })).toBeTruthy();
    expect(await screen.findByRole('img', { name: resources.fr.page.stats.daily })).toBeTruthy();
    expect(await screen.findAllByText('42')).toHaveLength(3);
    expect(screen.getByLabelText(resources.fr.page.stats.hotel)).toBeTruthy();
    expect(screen.getByRole('button', { name: resources.fr.page.stats.export })).toBeTruthy();
  });
});

const stats = {
  summary: { sessions: 42, averageSessionDurationMs: 127000, toursOpened: 53, scenesViewed: 116, hotspotClicks: 8, vrEntries: 3, qrScans: 4 },
  daily: [{ day: '2026-10-21', sessions: 42, toursOpened: 53, scenesViewed: 116 }],
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: hour === 10 ? 42 : 0 })),
  topTours: [{ id: 'tour-id', label: 'Oudayas', opens: 53 }],
  topScenes: [{ id: 'scene-id', label: 'Bab', views: 116 }],
  languages: [{ lang: 'fr', sessions: 42 }],
  channels: [{ channel: 'WEB', sessions: 42 }],
};

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return '';
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
