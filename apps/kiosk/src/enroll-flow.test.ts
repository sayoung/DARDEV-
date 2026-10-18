import { describe, expect, it, vi } from 'vitest';
import { KioskEnrollRequestSchema } from '@xplor/shared';

import { loadCredentials, type Storage } from './credentials.js';
import { enrollKiosk, resetEnrollment } from './enroll-flow.js';

const baseUrl = 'https://api.example.test/';
const validCode = 'AB12CD34';
const kioskId = '550e8400-e29b-41d4-a716-446655440000';
const token = 'kiosk-device-token';
const enrollSuccessResponse = { kioskId, token };
const customDeviceInfo = {
  userAgent: 'Xplor Kiosk Device/1.0',
  screen: '1920x1080',
};

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function fetchMock(
  response: Response | (() => Response),
): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>().mockImplementation(() => {
    const res = typeof response === 'function' ? response() : response.clone();
    return Promise.resolve(res);
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('flux d’enrôlement du kiosque (F-52, F-67)', () => {
  describe('succès', () => {
    it('enrôle le kiosque et sauvegarde les identifiants dans le stockage', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(jsonResponse(enrollSuccessResponse));

      const result = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
        deviceInfo: customDeviceInfo,
      });

      expect(result).toEqual({ ok: true });
      expect(loadCredentials(storage)).toEqual({ kioskId, token });

      const calls = fetchFn.mock.calls;
      expect(calls.length).toBe(1);
      const call = calls[0];
      expect(call?.[0]).toBe('https://api.example.test/api/v1/kiosk/enroll');
      expect(call?.[1]?.method).toBe('POST');
      expect(call?.[1]?.body).toBe(
        JSON.stringify({ code: validCode, deviceInfo: customDeviceInfo }),
      );
    });

    it('utilise des informations d’appareil par défaut quand deviceInfo n’est pas fourni', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(jsonResponse(enrollSuccessResponse));

      const result = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
      });

      expect(result).toEqual({ ok: true });
      expect(loadCredentials(storage)).toEqual({ kioskId, token });

      const calls = fetchFn.mock.calls;
      expect(calls.length).toBe(1);
      const call = calls[0];
      const rawBody = call?.[1]?.body;
      const jsonBody: unknown = typeof rawBody === 'string' ? JSON.parse(rawBody) : null;
      const parsed = KioskEnrollRequestSchema.safeParse(jsonBody);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe(validCode);
        expect(parsed.data.deviceInfo.userAgent.length).toBeGreaterThan(0);
      }
    });

    it('laisse propager l’erreur si le stockage échoue lors de saveCredentials (ne la masque pas)', async () => {
      const storage: Storage = {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota_exceeded');
        },
        removeItem: () => {},
      };
      const fetchFn = fetchMock(jsonResponse(enrollSuccessResponse));

      await expect(
        enrollKiosk({
          code: validCode,
          fetchFn,
          baseUrl,
          storage,
        }),
      ).rejects.toThrow('quota_exceeded');
    });
  });

  describe('code refusé', () => {
    it('renvoie INVALID_CODE et ne sauvegarde rien lorsque le serveur renvoie 401', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(new Response(null, { status: 401 }));

      const result = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
        deviceInfo: customDeviceInfo,
      });

      expect(result).toEqual({ ok: false, reason: 'INVALID_CODE' });
      expect(storage.values.size).toBe(0);
      expect(loadCredentials(storage)).toBeNull();
    });

    it('renvoie INVALID_CODE et ne sauvegarde rien lorsque le serveur renvoie 403 (kiosque désactivé)', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(new Response(null, { status: 403 }));

      const result = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
        deviceInfo: customDeviceInfo,
      });

      expect(result).toEqual({ ok: false, reason: 'INVALID_CODE' });
      expect(storage.values.size).toBe(0);
      expect(loadCredentials(storage)).toBeNull();
    });

    it('renvoie INVALID_CODE et ne sauvegarde rien lorsque le serveur renvoie 400', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(new Response(null, { status: 400 }));

      const result = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
      });

      expect(result).toEqual({ ok: false, reason: 'INVALID_CODE' });
      expect(storage.values.size).toBe(0);
      expect(loadCredentials(storage)).toBeNull();
    });

    it('renvoie INVALID_CODE et ne sauvegarde rien lorsque le code est malformé selon le schéma', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(jsonResponse(enrollSuccessResponse));

      const result = await enrollKiosk({
        code: 'TROP_COURT',
        fetchFn,
        baseUrl,
        storage,
      });

      expect(result).toEqual({ ok: false, reason: 'INVALID_CODE' });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(storage.values.size).toBe(0);
      expect(loadCredentials(storage)).toBeNull();
    });
  });

  describe('erreur réseau ou serveur', () => {
    it('renvoie NETWORK et ne sauvegarde rien quand la requête réseau échoue', async () => {
      const storage = new MemoryStorage();
      const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
        deviceInfo: customDeviceInfo,
      });

      expect(result).toEqual({ ok: false, reason: 'NETWORK' });
      expect(storage.values.size).toBe(0);
      expect(loadCredentials(storage)).toBeNull();
    });

    it('renvoie NETWORK et ne sauvegarde rien lorsque le serveur renvoie une erreur 500', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(new Response(null, { status: 500 }));

      const result = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
        deviceInfo: customDeviceInfo,
      });

      expect(result).toEqual({ ok: false, reason: 'NETWORK' });
      expect(storage.values.size).toBe(0);
      expect(loadCredentials(storage)).toBeNull();
    });

    it('renvoie NETWORK et ne sauvegarde rien lorsque la réponse serveur ne respecte pas le schéma (INVALID_RESPONSE)', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(jsonResponse({ kioskId: 'not-a-valid-uuid', token }));

      const result = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
      });

      expect(result).toEqual({ ok: false, reason: 'NETWORK' });
      expect(storage.values.size).toBe(0);
      expect(loadCredentials(storage)).toBeNull();
    });
  });

  describe('reset (réenrôlement F-67)', () => {
    it('efface les identifiants existants dans le stockage', () => {
      const storage = new MemoryStorage();
      storage.setItem(
        'xplor.kiosk.credentials',
        JSON.stringify({ kioskId, token }),
      );
      expect(loadCredentials(storage)).toEqual({ kioskId, token });

      resetEnrollment(storage);

      expect(loadCredentials(storage)).toBeNull();
      expect(storage.values.size).toBe(0);
    });

    it('permet de réenrôler après un reset complet', async () => {
      const storage = new MemoryStorage();
      const fetchFn = fetchMock(() => jsonResponse(enrollSuccessResponse));

      const firstEnroll = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
      });
      expect(firstEnroll).toEqual({ ok: true });
      expect(loadCredentials(storage)).toEqual({ kioskId, token });

      resetEnrollment(storage);
      expect(loadCredentials(storage)).toBeNull();

      const secondEnroll = await enrollKiosk({
        code: validCode,
        fetchFn,
        baseUrl,
        storage,
      });
      expect(secondEnroll).toEqual({ ok: true });
      expect(loadCredentials(storage)).toEqual({ kioskId, token });
    });
  });
});
