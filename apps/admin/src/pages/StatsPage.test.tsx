import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import {
  ContractType,
  HotelListResponseSchema,
  HotelStars,
  MeResponseSchema,
  Role,
  StatsDashboardSchema,
  type HotelListResponse,
  type MeResponse,
  type StatsDashboard,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App.js';
import { clearCsrfToken } from '../api/client.js';
import { i18n } from '../i18n.js';
import { LANG_STORAGE_KEY } from '../lang.js';

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

const adminProfile: MeResponse = MeResponseSchema.parse({
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d00',
  email: 'admin@example.test',
  name: 'Admin',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-token-123',
  totpEnabled: true,
});

const editorProfile: MeResponse = MeResponseSchema.parse({
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d01',
  email: 'editor@example.test',
  name: 'Editor',
  role: Role.EDITOR,
  uiLang: 'fr',
  csrfToken: 'csrf-token-456',
  totpEnabled: false,
});

const hotelList: HotelListResponse = HotelListResponseSchema.parse([
  {
    id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e',
    name: 'Hôtel Démonstration Rabat',
    stars: HotelStars.FIVE,
    cityId: '018f6b21-4d39-7a1b-8e45-3f8c5b2a1d11',
    address: '1 avenue de la Démonstration, Rabat',
    phone: '+212537000000',
    email: 'rabat.demo@xplor.local',
    brandColor: '#1F6F8B',
    contractType: ContractType.RENTAL,
    contractStart: '2026-01-01T00:00:00.000Z',
    contractEnd: '2027-01-01T00:00:00.000Z',
    languages: ['fr'],
    active: true,
    hasMaintenancePin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]);

const statsData: StatsDashboard = StatsDashboardSchema.parse({
  summary: {
    sessions: 42,
    averageSessionDurationMs: 127000,
    toursOpened: 53,
    scenesViewed: 116,
    hotspotClicks: 8,
    vrEntries: 3,
    qrScans: 4,
  },
  daily: [{ day: '2026-10-21', sessions: 42, toursOpened: 53, scenesViewed: 116 }],
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: hour === 10 ? 42 : 0 })),
  topTours: [{ id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e', label: 'Oudayas', opens: 53 }],
  topScenes: [{ id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d11', label: 'Bab', views: 116 }],
  languages: [{ lang: 'fr', sessions: 42 }],
  channels: [{ channel: 'WEB', sessions: 42 }],
});

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return '';
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(status: number, body: string, contentType = 'text/plain'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  });
}

describe('StatsPage (M7 F-81 / F-82)', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/stats?lang=fr');
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('dir', 'ltr');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, adminProfile));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, hotelList));
      if (url.includes('/admin/stats?')) return Promise.resolve(jsonResponse(200, statsData));
      if (url.includes('/admin/stats/export.csv?')) {
        return Promise.resolve(textResponse(200, '\uFEFF"Indicateur";"Valeur"', 'text/csv;charset=utf-8'));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rend la page en français avec les libellés de packages/i18n et dir=ltr', async () => {
    window.history.replaceState(null, '', '/stats?lang=fr');
    await i18n.changeLanguage('fr');
    render(<App />);

    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');

    expect(await screen.findByRole('heading', { name: resources.fr.page.stats.title })).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.subtitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: resources.fr.page.stats.export })).toBeTruthy();

    const applyButton = screen.getByRole('button', { name: resources.fr.page.stats.apply });
    const form = applyButton.closest('form');
    if (form === null) {
      throw new Error('Stats form not found');
    }
    const formScope = within(form);

    expect(formScope.getByLabelText(resources.fr.page.stats.from)).toBeTruthy();
    expect(formScope.getByLabelText(resources.fr.page.stats.to)).toBeTruthy();
    expect(formScope.getByLabelText(resources.fr.page.stats.hotel)).toBeTruthy();
    expect(formScope.getByLabelText(resources.fr.page.stats.tour)).toBeTruthy();
    expect(formScope.getByLabelText(resources.fr.page.stats.channel)).toBeTruthy();
    expect(formScope.getByLabelText(resources.fr.page.stats.language)).toBeTruthy();

    expect(await screen.findByRole('img', { name: resources.fr.page.stats.daily })).toBeTruthy();
    expect(screen.getByRole('img', { name: resources.fr.page.stats.hourly })).toBeTruthy();

    expect(screen.getByText(resources.fr.page.stats.metrics.sessions)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.metrics.averageDuration)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.metrics.toursOpened)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.metrics.scenesViewed)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.metrics.hotspotClicks)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.metrics.vrEntries)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.metrics.qrScans)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.minutes)).toBeTruthy();

    expect(screen.getByText(resources.fr.page.stats.topTours)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.topScenes)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.languages)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.stats.channels)).toBeTruthy();
    expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1);
  });

  it('applique dir=rtl en arabe, affiche les libellés traduits et replie les clés manquantes sur le français (D-03 suspendue)', async () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'ar');
    window.history.replaceState(null, '', '/stats?lang=ar');
    await i18n.changeLanguage('ar');
    render(<App />);

    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    // Header and layout in Arabic
    expect(await screen.findByRole('button', { name: resources.ar.auth.logout })).toBeTruthy();
    expect(screen.getByText(resources.ar.auth.role.ADMIN)).toBeTruthy();

    // Stats page labels in Arabic
    expect(await screen.findByRole('heading', { name: resources.ar.page.stats.title })).toBeTruthy();
    expect(screen.getByText(resources.ar.page.stats.subtitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: resources.ar.page.stats.export })).toBeTruthy();

    const applyButton = screen.getByRole('button', { name: resources.ar.page.stats.apply });
    const form = applyButton.closest('form');
    if (form === null) {
      throw new Error('Stats form not found');
    }
    const formScope = within(form);

    expect(formScope.getByLabelText(resources.ar.page.stats.from)).toBeTruthy();
    expect(formScope.getByLabelText(resources.ar.page.stats.to)).toBeTruthy();
    expect(formScope.getByLabelText(resources.ar.page.stats.hotel)).toBeTruthy();
    expect(formScope.getByLabelText(resources.ar.page.stats.tour)).toBeTruthy();
    expect(formScope.getByLabelText(resources.ar.page.stats.channel)).toBeTruthy();
    expect(formScope.getByLabelText(resources.ar.page.stats.language)).toBeTruthy();

    // Navigation links in Arabic
    expect(screen.getByRole('link', { name: resources.ar.nav.hotels })).toBeTruthy();
    expect(screen.getByRole('link', { name: resources.ar.nav.kiosks })).toBeTruthy();

    // Missing keys in Arabic fall back to French (D-03 suspendue)
    i18n.addResource('fr', 'translation', 'page.__repli_test__.title', 'Titre de repli');
    expect(i18n.t('page.__repli_test__.title', { lng: 'ar' })).toBe('Titre de repli');
  });

  it('applique dir=ltr en anglais, affiche les libellés traduits et replie les clés manquantes sur le français (D-03 suspendue)', async () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'en');
    window.history.replaceState(null, '', '/stats?lang=en');
    await i18n.changeLanguage('en');
    render(<App />);

    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');

    // Header and layout in English
    expect(await screen.findByRole('button', { name: resources.en.auth.logout })).toBeTruthy();
    expect(screen.getByText(resources.en.auth.role.ADMIN)).toBeTruthy();

    // Stats page labels in English
    expect(await screen.findByRole('heading', { name: resources.en.page.stats.title })).toBeTruthy();
    expect(screen.getByText(resources.en.page.stats.subtitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: resources.en.page.stats.export })).toBeTruthy();

    const applyButton = screen.getByRole('button', { name: resources.en.page.stats.apply });
    const form = applyButton.closest('form');
    if (form === null) {
      throw new Error('Stats form not found');
    }
    const formScope = within(form);

    expect(formScope.getByLabelText(resources.en.page.stats.from)).toBeTruthy();
    expect(formScope.getByLabelText(resources.en.page.stats.to)).toBeTruthy();
    expect(formScope.getByLabelText(resources.en.page.stats.hotel)).toBeTruthy();
    expect(formScope.getByLabelText(resources.en.page.stats.tour)).toBeTruthy();
    expect(formScope.getByLabelText(resources.en.page.stats.channel)).toBeTruthy();
    expect(formScope.getByLabelText(resources.en.page.stats.language)).toBeTruthy();

    // Navigation links in English
    expect(screen.getByRole('link', { name: resources.en.nav.hotels })).toBeTruthy();
    expect(screen.getByRole('link', { name: resources.en.nav.kiosks })).toBeTruthy();

    // Missing keys in English fall back to French (D-03 suspendue)
    i18n.addResource('fr', 'translation', 'page.__repli_test__.title', 'Titre de repli');
    expect(i18n.t('page.__repli_test__.title', { lng: 'en' })).toBe('Titre de repli');
  });

  it('envoie les filtres hôtel, visite, canal, langue et période à l\'API lors de l\'application', async () => {
    window.history.replaceState(null, '', '/stats?lang=fr');
    await i18n.changeLanguage('fr');
    render(<App />);

    expect(await screen.findByRole('heading', { name: resources.fr.page.stats.title })).toBeTruthy();
    expect(await screen.findByRole('img', { name: resources.fr.page.stats.daily })).toBeTruthy();

    const applyButton = screen.getByRole('button', { name: resources.fr.page.stats.apply });
    const form = applyButton.closest('form');
    if (form === null) {
      throw new Error('Stats form not found');
    }
    const formScope = within(form);

    const fromInput = formScope.getByLabelText(resources.fr.page.stats.from);
    const toInput = formScope.getByLabelText(resources.fr.page.stats.to);
    const hotelSelect = formScope.getByLabelText(resources.fr.page.stats.hotel);
    const tourSelect = formScope.getByLabelText(resources.fr.page.stats.tour);
    const channelSelect = formScope.getByLabelText(resources.fr.page.stats.channel);
    const langSelect = formScope.getByLabelText(resources.fr.page.stats.language);

    const targetHotel = hotelList[0];
    if (targetHotel === undefined) {
      throw new Error('Expected hotel in list');
    }
    const targetTour = statsData.topTours[0];
    if (targetTour === undefined) {
      throw new Error('Expected tour in statsData');
    }

    fireEvent.change(fromInput, { target: { value: '2026-10-01' } });
    fireEvent.change(toInput, { target: { value: '2026-10-15' } });
    fireEvent.change(hotelSelect, { target: { value: targetHotel.id } });
    fireEvent.change(tourSelect, { target: { value: targetTour.id } });
    fireEvent.change(channelSelect, { target: { value: 'KIOSK' } });
    fireEvent.change(langSelect, { target: { value: 'ar' } });

    fireEvent.click(applyButton);

    await waitFor(() => {
      const statsCalls = fetchMock.mock.calls.filter((call) =>
        requestUrl(call[0]).includes('/admin/stats?'),
      );
      expect(statsCalls.length).toBeGreaterThanOrEqual(2);
    });

    const statsCalls = fetchMock.mock.calls.filter((call) =>
      requestUrl(call[0]).includes('/admin/stats?'),
    );
    const latestCall = statsCalls[statsCalls.length - 1];
    if (latestCall === undefined) {
      throw new Error('Latest stats call not found');
    }

    const url = new URL(requestUrl(latestCall[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/admin/stats');
    expect(url.searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(url.searchParams.get('to')).toBe('2026-10-16T00:00:00.000Z');
    expect(url.searchParams.get('hotelId')).toBe(targetHotel.id);
    expect(url.searchParams.get('tourId')).toBe(targetTour.id);
    expect(url.searchParams.get('channel')).toBe('KIOSK');
    expect(url.searchParams.get('lang')).toBe('ar');
  });

  it('masque le filtre d\'hôtel pour un utilisateur avec le rôle EDITOR', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, editorProfile));
      if (url.includes('/admin/stats?')) return Promise.resolve(jsonResponse(200, statsData));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: resources.fr.page.stats.title })).toBeTruthy();
    expect(screen.queryByLabelText(resources.fr.page.stats.hotel)).toBeNull();
  });

  it('affiche l\'état de chargement et désactive les boutons pendant la requête', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, adminProfile));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, hotelList));
      if (url.includes('/admin/stats?')) {
        return new Promise<Response>(() => {
          // Promise that stays pending
        });
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);

    const statusElement = await screen.findByRole('status');
    expect(statusElement.textContent).toContain(resources.fr.common.loading);

    const exportButton = screen.getByRole('button', { name: resources.fr.page.stats.export });
    const applyButton = screen.getByRole('button', { name: resources.fr.page.stats.apply });
    expect(exportButton.hasAttribute('disabled')).toBe(true);
    expect(applyButton.hasAttribute('disabled')).toBe(true);
  });

  it('affiche une alerte d\'erreur traduite en cas d\'échec de l\'API des statistiques', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, adminProfile));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, hotelList));
      if (url.includes('/admin/stats?')) return Promise.resolve(jsonResponse(500, { error: 'Failed' }));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(resources.fr.page.stats.error);
  });

  it('exporte les statistiques en CSV et gère les erreurs d\'export', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:test-stats-csv');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(<App />);

    expect(await screen.findByRole('img', { name: resources.fr.page.stats.daily })).toBeTruthy();

    const exportButton = screen.getByRole('button', { name: resources.fr.page.stats.export });
    expect(exportButton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(exportButton);

    await waitFor(() => {
      const exportCalls = fetchMock.mock.calls.filter((call) =>
        requestUrl(call[0]).includes('/admin/stats/export.csv?'),
      );
      expect(exportCalls.length).toBe(1);
    });

    const exportCalls = fetchMock.mock.calls.filter((call) =>
      requestUrl(call[0]).includes('/admin/stats/export.csv?'),
    );
    const exportCall = exportCalls[0];
    if (exportCall === undefined) {
      throw new Error('Export call not found');
    }
    const exportUrl = new URL(requestUrl(exportCall[0]), 'http://localhost');
    expect(exportUrl.pathname).toBe('/api/v1/admin/stats/export.csv');
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-stats-csv');

    // Test error case on export failure
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, adminProfile));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, hotelList));
      if (url.includes('/admin/stats/export.csv?')) return Promise.resolve(jsonResponse(500, { error: 'Export failed' }));
      if (url.includes('/admin/stats?')) return Promise.resolve(jsonResponse(200, statsData));
      return Promise.resolve(jsonResponse(404, {}));
    });

    fireEvent.click(exportButton);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(resources.fr.page.stats.error);
  });
});
