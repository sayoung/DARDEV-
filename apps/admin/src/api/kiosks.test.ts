import { Role, type KioskCreate, type MeResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken, fetchCurrentUser } from './client.js';
import {
  createKiosk,
  deleteKiosk,
  disableKiosk,
  forceSyncKiosk,
  issueEnrollmentCode,
  listKiosks,
} from './kiosks.js';

const profile = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-for-kiosks',
} satisfies MeResponse;

const kioskId = '018f3a38-c393-79d2-97b7-5f214f4df7e3';
const hotelId = '018f3a38-c393-79d2-97b7-5f214f4df7e4';
const kiosk = {
  id: kioskId,
  label: 'Hall principal',
  hotelId,
  deviceType: 'TOUCH_SCREEN',
  status: 'PENDING',
  connectionState: 'PENDING',
  lastHeartbeatAt: null,
  appVersion: null,
  syncedManifestVersion: null,
  storageFreeMb: null,
  idleTimeoutSeconds: 90,
  createdAt: '2026-10-17T10:00:00.000Z',
};
const kiosks = { items: [kiosk] };
const createInput = {
  label: 'Hall principal',
  hotelId,
  deviceType: 'TOUCH_SCREEN',
  idleTimeoutSeconds: 90,
} satisfies KioskCreate;
const enrollmentCode = { code: 'AB12CD34', expiresAt: '2026-10-17T11:00:00.000Z' };

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

function lastCall(): { url: string; init: RequestInit | undefined } | undefined {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) return undefined;
  return { url: String(call[0]), init: call[1] as RequestInit | undefined };
}

function expectCsrf(): void {
  expect(new Headers(lastCall()?.init?.headers).get('X-CSRF-Token')).toBe(profile.csrfToken);
}

describe('kiosks API', () => {
  beforeEach(async () => {
    clearCsrfToken();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, profile));
    await fetchCurrentUser();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET liste les kiosques à la bonne URL et valide la réponse', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, kiosks));

    await expect(listKiosks()).resolves.toEqual(kiosks);

    expect(lastCall()?.url).toBe('/api/v1/admin/kiosks');
    expect(lastCall()?.init?.method).toBe('GET');
  });

  it('rejette une réponse de liste de kiosques invalide', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [{ id: 'not-a-uuid' }] }));

    await expect(listKiosks()).rejects.toThrow();
  });

  it('POST crée un kiosque avec son corps JSON et le jeton CSRF', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, kiosk));

    await expect(createKiosk(createInput)).resolves.toEqual(kiosk);

    expect(lastCall()?.url).toBe('/api/v1/admin/kiosks');
    expect(lastCall()?.init?.method).toBe('POST');
    expect(JSON.parse(lastCall()?.init?.body as string)).toEqual(createInput);
    expectCsrf();
  });

  it('rejette une réponse de création invalide', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'not-a-uuid' }));

    await expect(createKiosk(createInput)).rejects.toThrow();
  });

  it('POST demande un code d’enrôlement avec le jeton CSRF et valide la réponse', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, enrollmentCode));

    await expect(issueEnrollmentCode(kioskId)).resolves.toEqual(enrollmentCode);

    expect(lastCall()?.url).toBe(`/api/v1/admin/kiosks/${kioskId}/enrollment-code`);
    expect(lastCall()?.init?.method).toBe('POST');
    expectCsrf();
  });

  it('rejette une réponse de code d’enrôlement invalide', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { code: 'short' }));

    await expect(issueEnrollmentCode(kioskId)).rejects.toThrow();
  });

  it('POST désactive un kiosque avec le jeton CSRF et valide la réponse', async () => {
    const disabledKiosk = { ...kiosk, status: 'DISABLED', connectionState: 'DISABLED' };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, disabledKiosk));

    await expect(disableKiosk(kioskId)).resolves.toEqual(disabledKiosk);

    expect(lastCall()?.url).toBe(`/api/v1/admin/kiosks/${kioskId}/disable`);
    expect(lastCall()?.init?.method).toBe('POST');
    expectCsrf();
  });

  it('rejette une réponse de désactivation invalide', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 'not-a-uuid' }));

    await expect(disableKiosk(kioskId)).rejects.toThrow();
  });

  it('POST force la synchronisation avec le jeton CSRF et accepte 204', async () => {
    fetchMock.mockResolvedValueOnce(noContentResponse());

    await expect(forceSyncKiosk(kioskId)).resolves.toBeUndefined();

    expect(lastCall()?.url).toBe(`/api/v1/admin/kiosks/${kioskId}/force-sync`);
    expect(lastCall()?.init?.method).toBe('POST');
    expectCsrf();
  });

  it('DELETE supprime un kiosque avec le jeton CSRF et accepte 204', async () => {
    fetchMock.mockResolvedValueOnce(noContentResponse());

    await expect(deleteKiosk(kioskId)).resolves.toBeUndefined();

    expect(lastCall()?.url).toBe(`/api/v1/admin/kiosks/${kioskId}`);
    expect(lastCall()?.init?.method).toBe('DELETE');
    expectCsrf();
  });
});
