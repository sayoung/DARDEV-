import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { ContractType, HotelStars, Role, type HotelResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';

const hotel: HotelResponse = {
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
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('HotelsPage', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/hotels?lang=fr');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, [hotel]));
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('affiche les hôtels et le lien vers leur sélection', async () => {
    render(<App />);
    expect(await screen.findByText(hotel.name)).toBeTruthy();
    expect(screen.getByText(hotel.cityId)).toBeTruthy();
    expect(screen.getByRole('link', { name: resources.fr.page.hotels.selection }).getAttribute('href'))
      .toBe(`/hotels/${hotel.id}/selection?lang=fr`);
  });

  it('affiche un état de chargement pendant la requête', async () => {
    let resolveHotels: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/hotels')) {
        return new Promise((resolve) => { resolveHotels = resolve; });
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    expect((await screen.findByRole('status')).textContent).toContain(resources.fr.common.loading);
    resolveHotels?.(jsonResponse(200, [hotel]));
    expect(await screen.findByText(hotel.name)).toBeTruthy();
  });

  it('affiche un état vide quand aucun hôtel ne correspond', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(resources.fr.page.hotels.empty)).toBeTruthy();
    });
  });

  it('affiche une erreur si le chargement échoue', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, {
        id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
        uiLang: 'fr', csrfToken: 'csrf-admin',
      }));
      if (url.endsWith('/admin/hotels')) return Promise.resolve(jsonResponse(500, {}));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain(resources.fr.page.hotels.loadError);
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
