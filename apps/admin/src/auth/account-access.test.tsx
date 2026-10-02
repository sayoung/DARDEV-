import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();
const password = 'a'.repeat(12);

type ResetFailure = 'TOKEN_INVALID' | 'PASSWORD_TOO_COMMON' | 'PASSWORD_INVALID';

let resetFailure: ResetFailure = 'TOKEN_INVALID';

describe('réinitialisation et invitation', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('dir', 'ltr');
    await i18n.changeLanguage('fr');
    resetFailure = 'TOKEN_INVALID';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      return routeFetch(input, init);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('l’envoi de forgot affiche toujours le même message de confirmation', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: resources.fr.auth.login.title }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: resources.fr.auth.forgot.link }));

    expect(
      await screen.findByRole('heading', { name: resources.fr.auth.forgot.title }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(resources.fr.auth.forgot.email), {
      target: { value: 'ada@xplor.test' },
    });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.forgot.title }));

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      resources.fr.auth.forgot.sent,
    );
    const call = findCall('/auth/password/forgot');
    expect(call?.method).toBe('POST');
    expect(call?.credentials).toBe('include');
    expect(call?.init?.body).toBe(JSON.stringify({ email: 'ada@xplor.test' }));
    expect(window.location.pathname).toBe('/forgot');
  });

  it('des confirmations différentes affichent une erreur sans appel réseau', async () => {
    window.history.replaceState(null, '', '/reset/jeton-reset');
    render(<App />);
    await screen.findByLabelText(resources.fr.auth.setPassword.password);
    const before = fetchMock.mock.calls.length;

    fillPasswords(password, 'b'.repeat(12));
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.setPassword.titleReset }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.setPassword.mismatch);
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(findCall('/auth/password/reset')).toBeUndefined();
  });

  it('un mot de passe trop court est refusé par PasswordSchema sans appel réseau', async () => {
    window.history.replaceState(null, '', '/reset/jeton-reset');
    render(<App />);
    await screen.findByLabelText(resources.fr.auth.setPassword.password);
    const before = fetchMock.mock.calls.length;

    fillPasswords('court', 'court');
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.setPassword.titleReset }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.errors.PASSWORD_INVALID);
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(findCall('/auth/password/reset')).toBeUndefined();
  });

  it('un 400 TOKEN_INVALID affiche le message traduit', async () => {
    window.history.replaceState(null, '', '/reset/jeton-reset');
    render(<App />);
    await screen.findByLabelText(resources.fr.auth.setPassword.password);

    fillPasswords(password, password);
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.setPassword.titleReset }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.errors.TOKEN_INVALID);
    expect(findCall('/auth/password/reset')?.init?.body).toBe(
      JSON.stringify({ token: 'jeton-reset', password }),
    );
  });

  it.each(['PASSWORD_TOO_COMMON', 'PASSWORD_INVALID'] as const)(
    'un 400 %s affiche le message traduit',
    async (code) => {
      resetFailure = code;
      window.history.replaceState(null, '', '/reset/jeton-reset');
      render(<App />);
      await screen.findByLabelText(resources.fr.auth.setPassword.password);

      fillPasswords(password, password);
      fireEvent.submit(
        screen.getByRole('form', { name: resources.fr.auth.setPassword.titleReset }),
      );

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe(resources.fr.auth.errors[code]);
    },
  );

  it('une invitation réussie renvoie vers la connexion avec un message', async () => {
    window.history.replaceState(null, '', '/invite/jeton-invite');
    render(<App />);
    await screen.findByRole('heading', { name: resources.fr.auth.setPassword.titleInvite });

    fillPasswords(password, password);
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.setPassword.titleInvite }));

    expect(
      await screen.findByRole('heading', { name: resources.fr.auth.login.title }),
    ).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      resources.fr.auth.setPassword.successInvite,
    );
    expect(window.location.pathname).toBe('/');
    expect(new URLSearchParams(window.location.search).get('notice')).toBe('invite');
    expect(findCall('/auth/invite/accept')?.init?.body).toBe(
      JSON.stringify({ token: 'jeton-invite', password }),
    );
  });

  it('la page /reset en ?lang=ar pose dir=rtl', async () => {
    window.history.replaceState(null, '', '/reset/jeton-reset?lang=ar');
    render(<App />);

    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    const heading = await screen.findByRole('heading', {
      name: resources.ar.auth.setPassword.titleReset,
    });
    expect(heading).toBeTruthy();
    const form = screen.getByRole('form', { name: resources.ar.auth.setPassword.titleReset });
    expect(form).not.toBeNull();
    expect(getComputedStyle(form).direction).toBe('rtl');
  });
});

function routeFetch(input: unknown, init: unknown): Promise<Response> {
  const url = requestUrl(input);
  const method = methodOf(input, init);
  if (method !== 'POST') {
    return Promise.resolve(anonymous());
  }
  if (url.endsWith('/auth/password/forgot')) {
    return Promise.resolve(new Response(null, { status: 202 }));
  }
  if (url.endsWith('/auth/password/reset')) {
    return Promise.resolve(errorResponse(400, resetFailure));
  }
  if (url.endsWith('/auth/invite/accept')) {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  return Promise.resolve(anonymous());
}

function fillPasswords(value: string, confirmation: string): void {
  fireEvent.change(screen.getByLabelText(resources.fr.auth.setPassword.password), {
    target: { value },
  });
  fireEvent.change(screen.getByLabelText(resources.fr.auth.setPassword.confirm), {
    target: { value: confirmation },
  });
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
  return fetchMock.mock.calls
    .map((call) => {
      const init = isRequestInit(call[1]) ? call[1] : undefined;
      return {
        url: requestUrl(call[0]),
        method: (init?.method ?? methodOf(call[0], call[1])).toUpperCase(),
        credentials: init?.credentials,
        init,
      };
    })
    .find((call) => call.url.endsWith(suffix));
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
