import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse, type CityResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';

const profileAdmin: MeResponse = {
  id: 'user-admin',
  email: 'admin@xplor.test',
  name: 'Admin User',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-admin',
};

const profilePartner: MeResponse = {
  id: 'user-partner',
  email: 'partner@xplor.test',
  name: 'Partner User',
  role: Role.PARTNER,
  uiLang: 'fr',
  csrfToken: 'csrf-partner',
};

const mockCity: CityResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e', // Valid UUID v7 format
  name: { fr: 'Rabat', ar: 'الرباط', en: 'Rabat' },
  region: 'RSK',
  lat: 34.0,
  lng: -6.8,
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('CitiesPage', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/cities');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    
    // Default mock implementation
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profileAdmin));
      }
      if (url.endsWith('/admin/cities') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [mockCity]));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('affiche la liste des villes', async () => {
    render(<App />);
    expect(await screen.findByText('Rabat')).toBeTruthy();
    expect(screen.getByText('RSK')).toBeTruthy();
    expect(screen.getByText('34')).toBeTruthy();
  });

  it('création envoie le bon corps', async () => {
    render(<App />);
    await screen.findByText('Rabat');
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profileAdmin));
      }
      if (url.endsWith('/admin/cities') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [mockCity]));
      }
      if (url.endsWith('/admin/cities') && method === 'POST') {
        return Promise.resolve(jsonResponse(200, { ...mockCity, id: 'city-2' }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    const frInput = screen.getAllByRole('textbox').find(el => el.getAttribute('lang') === 'fr');
    expect(frInput).toBeTruthy();
    if (frInput) {
      fireEvent.change(frInput, { target: { value: 'Salé' } });
    }
    
    fireEvent.change(screen.getByLabelText(resources.fr.catalog.city.region), { target: { value: 'RSK' } });
    fireEvent.change(screen.getByLabelText(resources.fr.catalog.city.lat), { target: { value: '34.1' } });
    fireEvent.change(screen.getByLabelText(resources.fr.catalog.city.lng), { target: { value: '-6.7' } });
    
    fireEvent.click(screen.getByRole('button', { name: resources.fr.catalog.save }));
    
    await waitFor(() => {
      const postCall = recordedCalls().find(c => c.method === 'POST' && c.url.endsWith('/admin/cities'));
      expect(postCall).toBeTruthy();
      if (postCall && postCall.init) {
        expect(JSON.parse(postCall.init.body as string)).toEqual({
          name: { fr: 'Salé' },
          region: 'RSK',
          lat: 34.1,
          lng: -6.7,
        });
      }
    });
  });

  it('409 IN_USE traduit lors de la suppression', async () => {
    window.confirm = vi.fn(() => true);
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.endsWith('/admin/cities') && method === 'GET') return Promise.resolve(jsonResponse(200, [mockCity]));
      if (url.includes('/admin/cities/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e') && method === 'DELETE') {
        return Promise.resolve(errorResponse(409, 'IN_USE'));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findByText('Rabat');
    
    fireEvent.click(screen.getByRole('button', { name: resources.fr.catalog.delete }));
    
    await waitFor(() => {
      expect(screen.getByText(resources.fr.catalog.errors.inUse)).toBeTruthy();
    });
  });

  it('boutons absents pour PARTNER', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profilePartner));
      if (url.endsWith('/admin/cities') && method === 'GET') return Promise.resolve(jsonResponse(200, [mockCity]));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findByText('Rabat');
    
    expect(screen.queryByRole('button', { name: resources.fr.catalog.delete })).toBeNull();
    expect(screen.queryByRole('button', { name: resources.fr.catalog.edit })).toBeNull();
    expect(screen.queryByRole('button', { name: resources.fr.catalog.save })).toBeNull();
  });
});

// Helpers
function isRequestInit(value: unknown): value is RequestInit {
  return typeof value === 'object' && value !== null;
}

function methodOf(input: unknown, init?: unknown): string {
  if (isRequestInit(init) && typeof init.method === 'string') return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

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

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, { error: { code, message: code } });
}

type RecordedCall = {
  url: string;
  method: string;
  init: RequestInit | undefined;
};

function recordedCalls(): RecordedCall[] {
  return fetchMock.mock.calls.map((call) => {
    const init = isRequestInit(call[1]) ? call[1] : undefined;
    return {
      url: requestUrl(call[0]),
      method: (init?.method ?? methodOf(call[0], call[1])).toUpperCase(),
      init,
    };
  });
}
