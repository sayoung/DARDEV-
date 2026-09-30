import { Role, type MeResponse, z } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acceptInvite,
  apiFetch,
  clearCsrfToken,
  fetchCurrentUser,
  forgotPassword,
  login,
  logout,
  resetPassword,
  requestJson,
  ApiError,
} from './client.js';

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

  it('valide les schémas mot de passe avant d’envoyer la requête', async () => {
    await expect(forgotPassword({ email: 'pas-un-email' })).rejects.toThrow();
    await expect(resetPassword({ token: 'jeton', password: 'court' })).rejects.toThrow();
    await expect(acceptInvite({ token: '', password: 'a'.repeat(12) })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie forgot, reset et accept avec le corps parsé', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const password = 'a'.repeat(12);

    await forgotPassword({ email: 'ada@xplor.test' });
    expect(lastCall()?.url).toBe('/api/v1/auth/password/forgot');
    expect(lastCall()?.method).toBe('POST');
    expect(lastCall()?.credentials).toBe('include');
    expect(lastCall()?.init?.body).toBe(JSON.stringify({ email: 'ada@xplor.test' }));

    await resetPassword({ token: 'jeton', password });
    expect(lastCall()?.url).toBe('/api/v1/auth/password/reset');
    expect(lastCall()?.init?.body).toBe(JSON.stringify({ token: 'jeton', password }));

    await acceptInvite({ token: 'jeton', password });
    expect(lastCall()?.url).toBe('/api/v1/auth/invite/accept');
    expect(lastCall()?.init?.body).toBe(JSON.stringify({ token: 'jeton', password }));
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


describe('requestJson', () => {
  const schema = z.object({ ok: z.boolean() });

  beforeEach(() => {
    clearCsrfToken();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parse une réponse valide', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const result = await requestJson('/test', schema);
    expect(result).toEqual({ ok: true });
  });

  it('renvoie undefined sur 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await requestJson('/test', schema);
    expect(result).toBeUndefined();
  });

  it('jette ApiError avec code sur 422', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { error: { code: 'INVALID', message: 'msg' } }));
    try {
      await requestJson('/test', schema);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(422);
      expect((e as ApiError).code).toBe('INVALID');
    }
  });

  it('jette une erreur si la réponse ne correspond pas au schéma', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { bad: true }));
    await expect(requestJson('/test', schema)).rejects.toThrow();
  });

  it('envoie Content-Type application/json si body est présent', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await requestJson('/test', schema, { method: 'POST', body: JSON.stringify({ a: 1 }) });
    const call = lastCall();
    expect(headerOf(call, 'Content-Type')).toBe('application/json');
  });

  it('en-tête X-CSRF-Token présent sur POST et absent sur GET', async () => {
    // Simuler le login pour obtenir le jeton CSRF
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      id: 'user', email: 'u@test.com', name: 'U', role: 'ADMIN', uiLang: 'fr', csrfToken: 'fake-csrf'
    }));
    const { fetchCurrentUser } = await import('./client.js');
    await fetchCurrentUser();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await requestJson('/test', schema, { method: 'GET' });
    expect(headerOf(lastCall(), 'X-CSRF-Token')).toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await requestJson('/test', schema, { method: 'POST', body: '{}' });
    expect(headerOf(lastCall(), 'X-CSRF-Token')).toBe('fake-csrf');
  });
});
