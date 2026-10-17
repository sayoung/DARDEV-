import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      if (url.endsWith(`/admin/kiosks/${kiosk.id}/disable`)) {
        return Promise.resolve(jsonResponse(200, { ...kiosk, status: 'DISABLED', connectionState: 'DISABLED' }));
      }
      if (url.endsWith(`/admin/kiosks/${kiosk.id}/force-sync`)) return Promise.resolve(new Response(null, { status: 204 }));
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

  it('désactive un kiosque après confirmation avec son identifiant et le jeton CSRF, puis recharge la liste', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: resources.fr.page.kiosks.actions.disable }));

    await waitFor(() => {
      const disableCall = fetchMock.mock.calls.find(([input, init]) =>
        requestUrl(input).endsWith(`/admin/kiosks/${kiosk.id}/disable`)
        && (init as RequestInit | undefined)?.method === 'POST'
      );
      expect(disableCall).toBeDefined();
      expect(new Headers((disableCall?.[1] as RequestInit | undefined)?.headers).get('X-CSRF-Token')).toBe('csrf-admin');
      expect(fetchMock.mock.calls.filter(([input]) => requestUrl(input).endsWith('/admin/kiosks'))).toHaveLength(2);
    });
    expect(confirm).toHaveBeenCalledWith(resources.fr.page.kiosks.confirmDisable);
  });

  it('force la synchronisation par POST avec le bon identifiant et recharge la liste', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: resources.fr.page.kiosks.actions.forceSync }));

    await waitFor(() => {
      const syncCall = fetchMock.mock.calls.find(([input, init]) =>
        requestUrl(input).endsWith(`/admin/kiosks/${kiosk.id}/force-sync`)
        && (init as RequestInit | undefined)?.method === 'POST'
      );
      expect(syncCall).toBeDefined();
      expect(new Headers((syncCall?.[1] as RequestInit | undefined)?.headers).get('X-CSRF-Token')).toBe('csrf-admin');
      expect(fetchMock.mock.calls.filter(([input]) => requestUrl(input).endsWith('/admin/kiosks'))).toHaveLength(2);
    });
  });

  it('masque les actions de synchronisation pour les kiosques désactivés ou en attente', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/kiosks')) return Promise.resolve(jsonResponse(200, { items: [
        { ...kiosk, id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d21', label: 'Désactivé', status: 'DISABLED', connectionState: 'DISABLED' },
        { ...kiosk, id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d22', label: 'En attente', status: 'PENDING', connectionState: 'PENDING' },
      ] }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);

    expect(await screen.findAllByText('Désactivé')).toHaveLength(2);
    expect(screen.queryAllByRole('button', { name: resources.fr.page.kiosks.actions.disable })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: resources.fr.page.kiosks.actions.forceSync })).toBeNull();
  });

  it('affiche une alerte si une action échoue', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith(`/admin/kiosks/${kiosk.id}/disable`)) {
        return Promise.resolve(jsonResponse(500, {}));
      }
      if (url.endsWith('/admin/kiosks')) return Promise.resolve(jsonResponse(200, { items: [kiosk] }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: resources.fr.page.kiosks.actions.disable }));

    expect((await screen.findByRole('alert')).textContent).toContain(resources.fr.page.kiosks.actionError);
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
