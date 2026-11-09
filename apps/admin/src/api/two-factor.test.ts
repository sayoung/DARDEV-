import { Role, type MeResponse, type TwoFactorSetupResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  clearCsrfToken,
  fetchCurrentUser,
  resetIsRedirectingForTests,
} from './client.js';
import {
  beginTwoFactorSetup,
  confirmTwoFactor,
  disableTwoFactor,
} from './two-factor.js';

const profile: MeResponse = {
  id: 'user-admin-1',
  email: 'admin@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-for-two-factor-tests',
  totpEnabled: false,
};

const setupPayload: TwoFactorSetupResponse = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauthUri: 'otpauth://totp/Xplor:admin@xplor.test?secret=JBSWY3DPEHPK3PXP&issuer=Xplor',
};

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | null;
}

function lastCall(): RecordedCall | undefined {
  const call = fetchMock.mock.calls.at(-1);
  if (call === undefined) {
    return undefined;
  }
  const [input, init] = call;
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method = init?.method ?? 'GET';
  const headers = new Headers(init?.headers);
  const body = typeof init?.body === 'string' ? init.body : null;
  return { url, method, headers, body };
}

async function expectApiError(
  action: () => Promise<unknown>,
  expectedStatus: number,
  expectedCode?: string,
): Promise<void> {
  try {
    await action();
    expect.unreachable('La promesse aurait dû rejeter avec ApiError');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    if (error instanceof ApiError) {
      expect(error.status).toBe(expectedStatus);
      if (expectedCode !== undefined) {
        expect(error.code).toBe(expectedCode);
      }
    }
  }
}

describe('Client API 2FA (M8 F-90)', () => {
  beforeEach(async () => {
    clearCsrfToken();
    resetIsRedirectingForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(jsonResponse(200, profile));
    await fetchCurrentUser();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('beginTwoFactorSetup', () => {
    it('POST /api/v1/auth/2fa/setup avec succès, en-tête CSRF et valide la réponse', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, setupPayload));

      const result = await beginTwoFactorSetup();

      expect(result).toEqual(setupPayload);
      const call = lastCall();
      expect(call?.url).toBe('/api/v1/auth/2fa/setup');
      expect(call?.method).toBe('POST');
      expect(call?.headers.get('X-CSRF-Token')).toBe(profile.csrfToken);
    });

    it('n’envoie pas l’en-tête CSRF si le jeton n’est pas défini', async () => {
      clearCsrfToken();
      fetchMock.mockResolvedValueOnce(jsonResponse(200, setupPayload));

      await beginTwoFactorSetup();

      const call = lastCall();
      expect(call?.headers.get('X-CSRF-Token')).toBeNull();
    });

    it('rejette si la réponse n’est pas conforme au schéma TwoFactorSetupResponseSchema', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { secret: '' }));

      await expect(beginTwoFactorSetup()).rejects.toThrow();
    });

    it('convertit une réponse HTTP 400 en ApiError avec son code', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(400, {
          statusCode: 400,
          code: 'TWO_FACTOR_NOT_INITIALIZED',
          message: 'TWO_FACTOR_NOT_INITIALIZED',
        }),
      );

      await expectApiError(async () => {
        await beginTwoFactorSetup();
      }, 400, 'TWO_FACTOR_NOT_INITIALIZED');
    });

    it('convertit une réponse HTTP 401 en ApiError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { statusCode: 401, message: 'Unauthorized' }),
      );

      await expectApiError(async () => {
        await beginTwoFactorSetup();
      }, 401);
    });

    it('convertit une réponse HTTP 403 en ApiError avec son code', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, {
          statusCode: 403,
          code: 'TWO_FACTOR_ROLE_NOT_ALLOWED',
          message: 'Forbidden',
        }),
      );

      await expectApiError(async () => {
        await beginTwoFactorSetup();
      }, 403, 'TWO_FACTOR_ROLE_NOT_ALLOWED');
    });
  });

  describe('confirmTwoFactor', () => {
    it('valide le code avec TwoFactorCodeBodySchema et refuse un code invalide avant fetch', async () => {
      for (const invalidCode of ['12345', '1234567', 'abcdef', '', '12 456']) {
        await expect(confirmTwoFactor(invalidCode)).rejects.toThrow();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('POST /api/v1/auth/2fa/confirm avec succès (204 No Content), envoie le code et le CSRF', async () => {
      fetchMock.mockResolvedValueOnce(emptyResponse(204));

      await confirmTwoFactor('123456');

      const call = lastCall();
      expect(call?.url).toBe('/api/v1/auth/2fa/confirm');
      expect(call?.method).toBe('POST');
      expect(call?.headers.get('Content-Type')).toBe('application/json');
      expect(call?.headers.get('X-CSRF-Token')).toBe(profile.csrfToken);
      expect(call?.body).toBe(JSON.stringify({ code: '123456' }));
    });

    it('accepte un objet { code } validé', async () => {
      fetchMock.mockResolvedValueOnce(emptyResponse(204));

      await confirmTwoFactor({ code: '654321' });

      const call = lastCall();
      expect(call?.body).toBe(JSON.stringify({ code: '654321' }));
    });

    it('convertit une réponse HTTP 400 en ApiError avec TWO_FACTOR_INVALID_CODE', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(400, {
          statusCode: 400,
          code: 'TWO_FACTOR_INVALID_CODE',
          message: 'TWO_FACTOR_INVALID_CODE',
        }),
      );

      await expectApiError(async () => {
        await confirmTwoFactor('123456');
      }, 400, 'TWO_FACTOR_INVALID_CODE');
    });

    it('convertit une réponse HTTP 401 en ApiError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { statusCode: 401, message: 'Unauthorized' }),
      );

      await expectApiError(async () => {
        await confirmTwoFactor('123456');
      }, 401);
    });
  });

  describe('disableTwoFactor', () => {
    it('valide le code avec TwoFactorCodeBodySchema et refuse un code invalide avant fetch', async () => {
      for (const invalidCode of ['12345', '1234567', 'abcdef', '']) {
        await expect(disableTwoFactor(invalidCode)).rejects.toThrow();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('POST /api/v1/auth/2fa/disable avec succès (204 No Content), envoie le code et le CSRF', async () => {
      fetchMock.mockResolvedValueOnce(emptyResponse(204));

      await disableTwoFactor('123456');

      const call = lastCall();
      expect(call?.url).toBe('/api/v1/auth/2fa/disable');
      expect(call?.method).toBe('POST');
      expect(call?.headers.get('Content-Type')).toBe('application/json');
      expect(call?.headers.get('X-CSRF-Token')).toBe(profile.csrfToken);
      expect(call?.body).toBe(JSON.stringify({ code: '123456' }));
    });

    it('accepte un objet { code } validé', async () => {
      fetchMock.mockResolvedValueOnce(emptyResponse(204));

      await disableTwoFactor({ code: '987654' });

      const call = lastCall();
      expect(call?.body).toBe(JSON.stringify({ code: '987654' }));
    });

    it('convertit une réponse HTTP 400 en ApiError avec TWO_FACTOR_NOT_ENABLED', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(400, {
          statusCode: 400,
          code: 'TWO_FACTOR_NOT_ENABLED',
          message: 'TWO_FACTOR_NOT_ENABLED',
        }),
      );

      await expectApiError(async () => {
        await disableTwoFactor('123456');
      }, 400, 'TWO_FACTOR_NOT_ENABLED');
    });

    it('convertit une réponse HTTP 401 en ApiError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { statusCode: 401, message: 'Unauthorized' }),
      );

      await expectApiError(async () => {
        await disableTwoFactor('123456');
      }, 401);
    });
  });
});
