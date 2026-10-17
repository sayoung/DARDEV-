import { describe, expect, it, vi } from 'vitest';

import { enroll, fetchManifest, sendHeartbeat } from './kiosk-api.js';

const baseUrl = 'https://api.example.test/';
const token = 'device-token';
const enrollResponse = { kioskId: '550e8400-e29b-41d4-a716-446655440000', token };
const deviceInfo = { userAgent: 'Xplor kiosk' };
const manifest = {
  manifestVersion: 's1-aabbcc',
  kiosk: {
    id: enrollResponse.kioskId,
    label: 'Hall principal',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_SCREEN',
  },
  hotel: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Hôtel Exemple',
    logoUrl: null,
    brandColor: '#6958A5',
    languages: ['fr'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  selection: { featuredTourId: null, attractTourIds: [], tours: [] },
  categories: [],
};
const heartbeatBody = {
  appVersion: '1.0.0',
  syncedManifestVersion: manifest.manifestVersion,
  storageFreeMb: 512,
  recentErrors: [],
};
const heartbeatResponse = { forceSync: false, serverTime: '2026-10-17T12:00:00.000Z' };

function fetchMock(response: Response): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>().mockResolvedValue(response);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('client API du kiosque', () => {
  it('enroll poste le code et les informations de l’appareil puis valide la réponse', async () => {
    const fetchFn = fetchMock(jsonResponse(enrollResponse));

    await expect(enroll(fetchFn, baseUrl, 'AB12CD34', deviceInfo)).resolves.toEqual(enrollResponse);
    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe('https://api.example.test/api/v1/kiosk/enroll');
    expect(call?.[1]?.method).toBe('POST');
    expect(call?.[1]?.body).toBe(JSON.stringify({ code: 'AB12CD34', deviceInfo }));
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('fetchManifest utilise GET et le jeton Bearer puis valide le manifeste', async () => {
    const fetchFn = fetchMock(jsonResponse(manifest));

    await expect(fetchManifest(fetchFn, baseUrl, token)).resolves.toEqual(manifest);
    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe('https://api.example.test/api/v1/kiosk/manifest');
    expect(call?.[1]?.method).toBeUndefined();
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('sendHeartbeat poste les données avec le jeton Bearer puis valide la réponse', async () => {
    const fetchFn = fetchMock(jsonResponse(heartbeatResponse));

    await expect(sendHeartbeat(fetchFn, baseUrl, token, heartbeatBody)).resolves.toEqual(heartbeatResponse);
    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe('https://api.example.test/api/v1/kiosk/heartbeat');
    expect(call?.[1]?.method).toBe('POST');
    expect(call?.[1]?.body).toBe(JSON.stringify(heartbeatBody));
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('rejette une réponse qui ne correspond pas au schéma partagé', async () => {
    const fetchFn = fetchMock(jsonResponse({ kioskId: 'invalid', token }));

    await expect(enroll(fetchFn, baseUrl, 'AB12CD34', deviceInfo)).rejects.toMatchObject({
      name: 'KioskApiError',
      code: 'INVALID_RESPONSE',
    });
  });

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'KIOSK_DISABLED'],
  ] as const)('traduit HTTP %i en erreur %s', async (status, code) => {
    const fetchFn = fetchMock(new Response(null, { status }));

    const request = fetchManifest(fetchFn, baseUrl, token);
    await expect(request).rejects.toMatchObject({ code, status });
  });

  it('traduit une erreur réseau en NETWORK', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));

    await expect(fetchManifest(fetchFn, baseUrl, token)).rejects.toMatchObject({
      name: 'KioskApiError',
      code: 'NETWORK',
    });
  });
});
