import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse, type CategoryResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';
import { LANG_STORAGE_KEY } from '../lang.js';

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

const mockCategory: CategoryResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f',
  name: { fr: 'Nature', ar: 'طبيعة', en: 'Nature' },
  icon: 'tree',
  color: '#00FF00',
  weight: 10,
};

const createdCategoryId = '018f6b21-4d39-7a1b-8e45-3f8c5b2a1d10';

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('CategoriesPage', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/categories');
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
      if (url.endsWith('/admin/categories') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [mockCategory]));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('affiche la liste des categories', async () => {
    render(<App />);
    expect(await screen.findByText('Nature')).toBeTruthy();
    expect(screen.getByText('tree')).toBeTruthy();
    expect(screen.getByText('#00FF00')).toBeTruthy();
  });

  it('création envoie le bon corps', async () => {
    render(<App />);
    await screen.findByText('Nature');
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profileAdmin));
      }
      if (url.endsWith('/admin/categories') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [mockCategory]));
      }
      if (url.endsWith('/admin/categories') && method === 'POST') {
        return Promise.resolve(jsonResponse(201, { ...mockCategory, id: createdCategoryId }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    const frInput = screen.getAllByRole('textbox').find((el) => el.getAttribute('lang') === 'fr');
    expect(frInput).toBeDefined();
    fireEvent.change(frInput as HTMLElement, { target: { value: 'Culture' } });

    fireEvent.change(screen.getByLabelText(resources.fr.catalog.category.icon), { target: { value: 'museum' } });
    fireEvent.change(screen.getByLabelText(resources.fr.catalog.category.color), { target: { value: '#FF0000' } });
    fireEvent.change(screen.getByLabelText(resources.fr.catalog.category.weight), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: resources.fr.catalog.save }));

    await waitFor(() => {
      const calls = recordedCalls();
      const postCall = calls.find((c) => c.method === 'POST' && c.url.endsWith('/admin/categories'));
      expect(postCall?.init?.body).toBe(JSON.stringify({
        name: { fr: 'Culture' },
        icon: 'museum',
        color: '#ff0000',
        weight: 5,
      }));
      const gets = calls.filter((c) => c.method === 'GET' && c.url.endsWith('/admin/categories'));
      expect(gets).toHaveLength(2);
    });
    expect(screen.queryByText(resources.fr.catalog.errors.generic)).toBeNull();
  });

  it('poids 1.5 : aucun POST et message invalidForm', async () => {
    render(<App />);
    await screen.findByText('Nature');

    const frInput = screen.getAllByRole('textbox').find((el) => el.getAttribute('lang') === 'fr');
    expect(frInput).toBeDefined();
    fireEvent.change(frInput as HTMLElement, { target: { value: 'Culture' } });
    fireEvent.change(screen.getByLabelText(resources.fr.catalog.category.icon), { target: { value: 'museum' } });
    fireEvent.change(screen.getByLabelText(resources.fr.catalog.category.weight), { target: { value: '1.5' } });

    fireEvent.click(screen.getByRole('button', { name: resources.fr.catalog.save }));

    expect(await screen.findByText(resources.fr.catalog.errors.invalidForm)).toBeTruthy();
    const postCall = recordedCalls().find((c) => c.method === 'POST' && c.url.endsWith('/admin/categories'));
    expect(postCall).toBeUndefined();
  });

  it('repli français et indicateur quand la traduction anglaise manque', async () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'en');
    await i18n.changeLanguage('en');
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profileAdmin));
      }
      if (url.endsWith('/admin/categories') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [{ ...mockCategory, name: { fr: 'Nature', ar: 'طبيعة' } }]));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    const nameCell = await screen.findByRole('cell', { name: /Nature/ });
    expect(within(nameCell).getByText('Nature')).toBeTruthy();
    expect(within(nameCell).getByText(resources.en.catalog.translation.missing)).toBeTruthy();
  });

  it('409 IN_USE traduit lors de la suppression', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.endsWith('/admin/categories') && method === 'GET') return Promise.resolve(jsonResponse(200, [mockCategory]));
      if (url.includes('/admin/categories/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'DELETE') {
        return Promise.resolve(errorResponse(409, 'IN_USE'));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findByText('Nature');
    
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
      if (url.endsWith('/admin/categories') && method === 'GET') return Promise.resolve(jsonResponse(200, [mockCategory]));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findByText('Nature');
    
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
