import { Role, type MeResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken, fetchCurrentUser } from './client.js';
import { getHotelSelection, saveHotelSelection } from './hotels.js';

const profile = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-for-selection',
} satisfies MeResponse;

const hotelId = '018f3a38-c393-79d2-97b7-5f214f4df7e3';
const tourId = '018f3a38-c393-79d2-97b7-5f214f4df7e4';
const selection = {
  hotelId,
  version: 1,
  featuredTourId: tourId,
  attractTourIds: [tourId],
  items: [{ tourId, position: 0 }],
  updatedAt: '2026-10-17T10:00:00.000Z',
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function lastCall(): { url: string; init: RequestInit | undefined } | undefined {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) return undefined;
  return { url: String(call[0]), init: call[1] as RequestInit | undefined };
}

describe('hotel selection API', () => {
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

  it('GET lit la sélection à la bonne URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, selection));

    await expect(getHotelSelection(hotelId)).resolves.toEqual(selection);

    expect(lastCall()?.url).toBe(`/api/v1/admin/hotels/${hotelId}/selection`);
    expect(lastCall()?.init?.method).toBe('GET');
  });

  it('PUT envoie la sélection avec le corps JSON et le jeton CSRF', async () => {
    const update = {
      tourIds: [tourId],
      featuredTourId: tourId,
      attractTourIds: [tourId],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, selection));

    await expect(saveHotelSelection(hotelId, update)).resolves.toEqual(selection);

    expect(lastCall()?.url).toBe(`/api/v1/admin/hotels/${hotelId}/selection`);
    expect(lastCall()?.init?.method).toBe('PUT');
    expect(JSON.parse(lastCall()?.init?.body as string)).toEqual(update);
    expect(new Headers(lastCall()?.init?.headers).get('X-CSRF-Token')).toBe(profile.csrfToken);
  });

  it('rejette une réponse de sélection invalide', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { hotelId, version: 0 }));

    await expect(getHotelSelection(hotelId)).rejects.toThrow();
  });
});
