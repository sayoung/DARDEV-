import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App.js';
import * as catalog from '../api/catalog.js';

vi.mock('../api/catalog.js', () => ({
  listTours: vi.fn(),
}));

vi.mock('../api/hotels.js', () => ({
  listHotels: vi.fn().mockResolvedValue([]),
}));

vi.mock('../api/kiosks.js', () => ({
  listKiosks: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
  disableKiosk: vi.fn(),
  forceSyncKiosk: vi.fn(),
}));

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return '';
}

function methodOf(input: unknown, init: unknown): string {
  if (typeof init === 'object' && init !== null && 'method' in init && typeof init.method === 'string') {
    return init.method.toUpperCase();
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

describe('AppLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('dir', 'ltr');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('affiche le profil de l\'utilisateur et la navigation, gère la déconnexion sans doublons', async () => {
    vi.mocked(catalog.listTours).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 1,
    });

    const fetchMock = vi.fn((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(new Response(
          JSON.stringify({
            id: 'u1',
            email: 'alice@xplor.test',
            name: 'Alice Martin',
            role: Role.ADMIN,
            uiLang: 'fr',
            csrfToken: 'csrf-tok',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      if (method === 'POST' && url.endsWith('/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 401 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findAllByText('Alice Martin')).toHaveLength(1);
    expect(screen.getAllByText(resources.fr.auth.role.ADMIN)).toHaveLength(1);

    const nav = screen.getByRole('navigation', { name: resources.fr.nav.label });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(7);
    expect(links[0]?.textContent).toBe(resources.fr.nav.home);
    expect(links[1]?.textContent).toBe(resources.fr.nav.tours);
    expect(links[2]?.textContent).toBe(resources.fr.nav.cities);
    expect(links[3]?.textContent).toBe(resources.fr.nav.hotels);
    expect(links[4]?.textContent).toBe(resources.fr.nav.categories);
    expect(links[5]?.textContent).toBe(resources.fr.nav.media);
    const kiosksLink = screen.getByRole('link', { name: resources.fr.nav.kiosks });
    expect(kiosksLink.getAttribute('href')).toBe('/kiosks');
    expect(kiosksLink.getAttribute('aria-current')).toBeNull();

    fireEvent.click(kiosksLink);
    expect((await screen.findByRole('link', { name: resources.fr.nav.kiosks })).getAttribute('aria-current')).toBe('page');

    const logoutButton = screen.getByRole('button', { name: resources.fr.auth.logout });
    fireEvent.click(logoutButton);

    const logoutCall = fetchMock.mock.calls.find((call) => {
      return requestUrl(call[0]).endsWith('/auth/logout');
    });
    if (!logoutCall) {
      throw new Error('Logout call not found');
    }
    expect(methodOf(logoutCall[0], logoutCall[1])).toBe('POST');
  });
});
