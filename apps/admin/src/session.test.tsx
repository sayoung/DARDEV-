import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from './api/client.js';
import { App } from './App.js';
import { i18n } from './i18n.js';
import { LANG_STORAGE_KEY } from './lang.js';

const profile = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-from-me',
} satisfies MeResponse;

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('session du back-office', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('dir', 'ltr');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('affiche le formulaire en arabe avec dir=rtl', async () => {
    window.history.replaceState(null, '', '/?lang=ar');
    fetchMock.mockResolvedValue(anonymous());
    render(<App />);

    const email = await screen.findByLabelText(resources.ar.auth.login.email);
    expect(screen.getByLabelText(resources.ar.auth.login.password)).toBeTruthy();
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    const form = email.closest('form');
    expect(form).not.toBeNull();
    if (form !== null) {
      expect(getComputedStyle(form).direction).toBe('rtl');
    }
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBeNull();
  });

  it('une connexion réussie affiche le nom', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      if (methodOf(input, init) === 'POST' && requestUrl(input).endsWith('/auth/login')) {
        return Promise.resolve(jsonResponse(200, profile));
      }
      if (methodOf(input, init) === 'GET') {
        return Promise.resolve(jsonResponse(200, { items: [], total: 0 }));
      }
      return Promise.resolve(anonymous());
    });
    render(<App />);
    await submitLogin('ada@xplor.test', 'correct-horse');

    expect(await screen.findAllByText(profile.name)).toBeTruthy();
    expect(screen.getByText(resources.fr.auth.role.ADMIN)).toBeTruthy();
    expect(screen.queryByText(profile.role)).toBeNull();
    expect(screen.queryByRole('form', { name: resources.fr.auth.login.title })).toBeNull();
    const loginCall = findCall('/auth/login');
    expect(loginCall?.credentials).toBe('include');
    expect(loginCall?.init?.body).toBe(
      JSON.stringify({ email: 'ada@xplor.test', password: 'correct-horse' }),
    );
  });

  it('un 401 INVALID_CREDENTIALS affiche l’erreur', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      if (methodOf(input, init) === 'POST') {
        return Promise.resolve(errorResponse(401, 'INVALID_CREDENTIALS'));
      }
      return Promise.resolve(anonymous());
    });
    render(<App />);
    await submitLogin('ada@xplor.test', 'mauvais-mot-de-passe');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.login.error);
    expect(screen.queryByText(profile.name)).toBeNull();
  });

  it('affiche le message d’expiration et nettoie l’URL après connexion', async () => {
    window.history.replaceState(null, '', '/tours?notice=expired');
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      if (methodOf(input, init) === 'POST' && requestUrl(input).endsWith('/auth/login')) {
        return Promise.resolve(jsonResponse(200, profile));
      }
      if (methodOf(input, init) === 'GET') {
        return Promise.resolve(jsonResponse(200, { items: [], total: 0 }));
      }
      return Promise.resolve(anonymous());
    });
    render(<App />);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.textContent).toBe(resources.fr.auth.login.expired);

    await submitLogin('ada@xplor.test', 'correct-horse');

    expect(await screen.findAllByText(profile.name)).toBeTruthy();
    expect(window.location.pathname).toBe('/tours');
    expect(window.location.search).toBe('');
  });


  it('affiche le rôle traduit en arabe', async () => {
    window.history.replaceState(null, '', '/?lang=ar');
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      if (methodOf(input, init) === 'POST' && requestUrl(input).endsWith('/auth/login')) {
        return Promise.resolve(jsonResponse(200, profile));
      }
      if (methodOf(input, init) === 'GET') {
        return Promise.resolve(jsonResponse(200, { items: [], total: 0 }));
      }
      return Promise.resolve(anonymous());
    });
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: resources.ar.auth.login.title }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(resources.ar.auth.login.email), {
      target: { value: 'ada@xplor.test' },
    });
    fireEvent.change(screen.getByLabelText(resources.ar.auth.login.password), {
      target: { value: 'correct-horse' },
    });
    fireEvent.submit(screen.getByRole('form', { name: resources.ar.auth.login.title }));

    expect(await screen.findByText(resources.ar.auth.role.ADMIN)).toBeTruthy();
    expect(screen.queryByText(profile.role)).toBeNull();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    const home = screen.getByText(resources.ar.auth.role.ADMIN).closest('header');
    expect(home).not.toBeNull();
    if (home !== null) {
      expect(getComputedStyle(home).direction).toBe('rtl');
    }
  });

  it('un 423 ACCOUNT_LOCKED affiche le verrouillage', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      if (methodOf(input, init) === 'POST') {
        return Promise.resolve(errorResponse(423, 'ACCOUNT_LOCKED'));
      }
      return Promise.resolve(anonymous());
    });
    render(<App />);
    await submitLogin('ada@xplor.test', 'encore-un-essai');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.login.locked);
    expect(screen.queryByText(resources.fr.auth.login.error)).toBeNull();
  });

  it('un autre échec de connexion affiche un message', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      if (methodOf(input, init) === 'POST') {
        return Promise.resolve(errorResponse(500, 'INTERNAL'));
      }
      return Promise.resolve(anonymous());
    });
    render(<App />);
    await submitLogin('ada@xplor.test', 'mot-de-passe-valide');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.login.failed);
    expect(screen.queryByText(resources.fr.auth.login.error)).toBeNull();
    expect(screen.queryByText(resources.fr.auth.login.locked)).toBeNull();
  });

  it('une erreur réseau à la connexion affiche un message', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      if (methodOf(input, init) === 'POST') {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve(anonymous());
    });
    render(<App />);
    await submitLogin('ada@xplor.test', 'mot-de-passe-valide');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.login.failed);
  });

  it('la déconnexion envoie l’en-tête X-CSRF-Token', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      if (methodOf(input, init) === 'POST' && requestUrl(input).endsWith('/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return Promise.resolve(jsonResponse(200, profile));
    });
    render(<App />);
    expect(await screen.findAllByText(profile.name)).toBeTruthy();
    const logoutButton = screen.getAllByRole('button', { name: resources.fr.auth.logout })[0];
    if (!logoutButton) throw new Error('Logout button not found');
    fireEvent.click(logoutButton);
    expect(
      await screen.findByRole('heading', { name: resources.fr.auth.login.title }),
    ).toBeTruthy();
    const logoutCall = findCall('/auth/logout');
    expect(logoutCall?.method).toBe('POST');
    expect(logoutCall?.credentials).toBe('include');
    expect(headerOf(logoutCall, 'X-CSRF-Token')).toBe(profile.csrfToken);
  });
});

async function submitLogin(email: string, password: string): Promise<void> {
  expect(await screen.findByRole('heading', { name: resources.fr.auth.login.title })).toBeTruthy();
  fireEvent.change(screen.getByLabelText(resources.fr.auth.login.email), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(resources.fr.auth.login.password), {
    target: { value: password },
  });
  fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.login.title }));
}

function anonymous(): Response {
  return jsonResponse(401, { statusCode: 401, message: 'Unauthorized' });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, { statusCode: status, code, message: code });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type RecordedCall = {
  url: string;
  method: string;
  credentials: RequestCredentials | undefined;
  init: RequestInit | undefined;
};

function findCall(suffix: string): RecordedCall | undefined {
  return recordedCalls().find((call) => call.url.endsWith(suffix));
}

function recordedCalls(): RecordedCall[] {
  return fetchMock.mock.calls.map((call) => {
    const init = isRequestInit(call[1]) ? call[1] : undefined;
    return {
      url: requestUrl(call[0]),
      method: (init?.method ?? methodOf(call[0], call[1])).toUpperCase(),
      credentials: init?.credentials,
      init,
    };
  });
}

function headerOf(call: RecordedCall | undefined, name: string): string | null {
  if (call?.init?.headers === undefined) {
    return null;
  }
  return new Headers(call.init.headers).get(name);
}

function methodOf(input: unknown, init: unknown): string {
  if (isRequestInit(init) && typeof init.method === 'string') {
    return init.method.toUpperCase();
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function requestUrl(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.url;
  }
  return '';
}

function isRequestInit(value: unknown): value is RequestInit {
  return typeof value === 'object' && value !== null;
}
