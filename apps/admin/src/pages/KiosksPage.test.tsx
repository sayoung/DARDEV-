import { cleanup, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { ContractType, HotelStars, Role, type Kiosk } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';

const hotelId = '018f6b21-4d39-7a1b-8e45-3f8c5b2a1d11';
const kiosk: Kiosk = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e',
  label: 'Hall principal',
  hotelId,
  deviceType: 'TOUCH_SCREEN',
  status: 'ACTIVE',
  connectionState: 'ONLINE',
  lastHeartbeatAt: '2026-10-17T10:00:00.000Z',
  appVersion: '1.2.3',
  syncedManifestVersion: 's1',
  storageFreeMb: 2048,
  idleTimeoutSeconds: 90,
  createdAt: '2026-10-17T09:00:00.000Z',
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('KiosksPage', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/kiosks?lang=fr');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/kiosks')) return Promise.resolve(jsonResponse(200, { items: [kiosk] }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, [{
        id: hotelId, name: 'Hôtel Démonstration Rabat', stars: HotelStars.FIVE, cityId: hotelId,
        address: '1 avenue de la Démonstration, Rabat', phone: '+212537000000', email: 'rabat.demo@xplor.local',
        brandColor: '#6958A5', contractType: ContractType.RENTAL,
        contractStart: '2026-01-01T00:00:00.000Z', contractEnd: '2027-01-01T00:00:00.000Z', languages: ['fr'], active: true,
        hasMaintenancePin: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }]));
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('affiche les kiosques, leur hôtel résolu et leurs informations', async () => {
    render(<App />);

    expect(await screen.findByText(kiosk.label)).toBeTruthy();
    expect(screen.getByText('Hôtel Démonstration Rabat')).toBeTruthy();
    expect(screen.getByText(resources.fr.page.kiosks.status.online)).toBeTruthy();
    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.getByText(resources.fr.page.kiosks.freeSpaceValue.replace('{{mb}}', '2048'))).toBeTruthy();
  });

  it('traduit les différents états de connexion', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/kiosks')) return Promise.resolve(jsonResponse(200, {
        items: ['OFFLINE', 'DESYNCHRONIZED', 'PENDING', 'DISABLED'].map((connectionState, index) => ({
          ...kiosk,
          id: [
            '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d11',
            '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d12',
            '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d13',
            '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d14',
          ][index],
          label: `Kiosque ${String(index + 1)}`,
          connectionState,
        })),
      }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);

    for (const state of ['offline', 'outOfSync', 'pending', 'disabled'] as const) {
      expect(await screen.findByText(resources.fr.page.kiosks.status[state])).toBeTruthy();
    }
  });

  it('affiche un état vide quand aucun kiosque ne correspond', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/kiosks')) return Promise.resolve(jsonResponse(200, { items: [] }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    expect(await screen.findByText(resources.fr.page.kiosks.empty)).toBeTruthy();
  });

  it('affiche une erreur si le chargement échoue', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/kiosks')) return Promise.resolve(jsonResponse(500, {}));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain(resources.fr.page.kiosks.loadError);
  });
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
