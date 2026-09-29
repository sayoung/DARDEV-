import { Role, type MeResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, clearCsrfToken, fetchCurrentUser, login, logout } from './client.js';

const profile = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-from-me',
} satisfies MeResponse;

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('client auth', () => {
  beforeEach(() => {
    clearCsrfToken();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('valide LoginRequestSchema avant d’envoyer la requête', async () => {
    await expect(login({ email: 'pas-un-email', password: 'secret' })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('valide MeResponseSchema et ne mémorise pas un corps invalide', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { name: 'Ada' }));
    await expect(login({ email: 'ada@xplor.test', password: 'secret' })).rejects.toThrow();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    expect(headerOf(lastCall(), 'X-CSRF-Token')).toBeNull();
  });

  it('envoie X-CSRF-Token sauf pour GET, HEAD et OPTIONS', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(200, profile)));
    await fetchCurrentUser();
    expect(headerOf(lastCall(), 'X-CSRF-Token')).toBeNull();
    expect(lastCall()?.credentials).toBe('include');

    for (const method of ['HEAD', 'OPTIONS'] as const) {
      await apiFetch('/api/v1/auth/logout', { method });
      expect(headerOf(lastCall(), 'X-CSRF-Token')).toBeNull();
    }

    await logout();
    const call = lastCall();
    expect(call?.method).toBe('POST');
    expect(call?.credentials).toBe('include');
    expect(headerOf(call, 'X-CSRF-Token')).toBe(profile.csrfToken);
    expect(call?.url).toBe('/api/v1/auth/logout');
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function lastCall():
  | {
      url: string;
      method: string;
      credentials: RequestCredentials | undefined;
      init: RequestInit | undefined;
    }
  | undefined {
  const call = fetchMock.mock.calls.at(-1);
  if (call === undefined) {
    return undefined;
  }
  const init = isRequestInit(call[1]) ? call[1] : undefined;
  return {
    url: requestUrl(call[0]),
    method: (init?.method ?? 'GET').toUpperCase(),
    credentials: init?.credentials,
    init,
  };
}

function headerOf(
  call: { init: RequestInit | undefined } | undefined,
  name: string,
): string | null {
  if (call?.init?.headers === undefined) {
    return null;
  }
  return new Headers(call.init.headers).get(name);
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
