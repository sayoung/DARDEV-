import {
  Role,
  type AdminUser,
  type MeResponse,
  type PaginatedAdminUsersResponse,
  type UpdateAdminUserRequest,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  clearCsrfToken,
  fetchCurrentUser,
  resetIsRedirectingForTests,
} from './client.js';
import {
  getUser,
  listUsers,
  setUserHotels,
  updateUser,
} from './users.js';

const profile: MeResponse = {
  id: '018f3a38-c393-79d2-97b7-5f214f4df7e0',
  email: 'ada@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-token-for-users-tests',
  totpEnabled: false,
};

const userId = '018f3a38-c393-79d2-97b7-5f214f4df7e1';
const hotelId1 = '018f3a38-c393-79d2-97b7-5f214f4df7e2';
const hotelId2 = '018f3a38-c393-79d2-97b7-5f214f4df7e3';

const sampleUser: AdminUser = {
  id: userId,
  email: 'ada@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  active: true,
  totpEnabled: false,
  lastLoginAt: '2026-10-01T12:00:00.000Z',
  uiLang: 'fr',
  hotelIds: [hotelId1],
};

const sampleUsersPage: PaginatedAdminUsersResponse = {
  items: [sampleUser],
  total: 1,
  page: 1,
  pageSize: 20,
};

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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

function lastCallJson(): unknown {
  const call = lastCall();
  if (call === undefined || call.body === null) {
    return undefined;
  }
  return JSON.parse(call.body);
}

function expectCsrfHeader(): void {
  const call = lastCall();
  expect(call?.headers.get('X-CSRF-Token')).toBe(profile.csrfToken);
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

describe('Client API des utilisateurs (apps/admin/src/api/users.ts)', () => {
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

  describe('listUsers', () => {
    it('GET sans paramètres appelle /api/v1/admin/users et omet la query string', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleUsersPage));

      const result = await listUsers();

      expect(result).toEqual(sampleUsersPage);
      const call = lastCall();
      expect(call?.url).toBe('/api/v1/admin/users');
      expect(call?.method).toBe('GET');
    });

    it('GET avec objet vide appelle /api/v1/admin/users sans point d interrogation', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleUsersPage));

      await listUsers({});

      expect(lastCall()?.url).toBe('/api/v1/admin/users');
    });

    it('construit la query string complète quand tous les paramètres sont fournis', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleUsersPage));

      await listUsers({
        page: 2,
        pageSize: 50,
        role: Role.ADMIN,
        active: true,
        q: 'alice',
      });

      const url = new URL(lastCall()?.url ?? '', 'http://localhost');
      expect(url.pathname).toBe('/api/v1/admin/users');
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.searchParams.get('pageSize')).toBe('50');
      expect(url.searchParams.get('role')).toBe('ADMIN');
      expect(url.searchParams.get('active')).toBe('true');
      expect(url.searchParams.get('q')).toBe('alice');
    });

    it('omet strictement les paramètres absents ou undefined de la query string', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleUsersPage));

      await listUsers({
        page: 3,
        active: false,
      });

      const url = new URL(lastCall()?.url ?? '', 'http://localhost');
      expect(url.pathname).toBe('/api/v1/admin/users');
      expect(url.searchParams.get('page')).toBe('3');
      expect(url.searchParams.get('active')).toBe('false');
      expect(url.searchParams.has('pageSize')).toBe(false);
      expect(url.searchParams.has('role')).toBe(false);
      expect(url.searchParams.has('q')).toBe(false);
    });

    it('omet les paramètres quand ils valent explicitement undefined', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleUsersPage));

      await listUsers({
        page: undefined,
        pageSize: undefined,
        role: undefined,
        active: undefined,
        q: undefined,
      });

      expect(lastCall()?.url).toBe('/api/v1/admin/users');
    });

    it('ignore une chaîne de recherche vide ou ne contenant que des espaces', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleUsersPage));

      await listUsers({ q: '   ' });

      expect(lastCall()?.url).toBe('/api/v1/admin/users');
    });

    it('valide la réponse avec PaginatedAdminUsersResponseSchema et rejette les données non conformes', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          items: [{ id: 'not-a-uuid', email: 'invalid' }],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      );

      await expect(listUsers()).rejects.toThrow();
    });

    it('convertit une réponse HTTP 403 en ApiError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Accès refusé',
        }),
      );

      await expectApiError(() => listUsers(), 403, 'FORBIDDEN');
    });
  });

  describe('getUser', () => {
    it('GET /api/v1/admin/users/:id appelle la bonne URL avec GET et valide la réponse', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleUser));

      const result = await getUser(userId);

      expect(result).toEqual(sampleUser);
      const call = lastCall();
      expect(call?.url).toBe(`/api/v1/admin/users/${userId}`);
      expect(call?.method).toBe('GET');
    });

    it('rejette une réponse invalide pour getUser', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          id: userId,
          email: 'invalid-email',
        }),
      );

      await expect(getUser(userId)).rejects.toThrow();
    });

    it('convertit une réponse HTTP 403 en ApiError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Accès refusé',
        }),
      );

      await expectApiError(() => getUser(userId), 403, 'FORBIDDEN');
    });

    it('convertit une réponse HTTP 404 en ApiError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, {
          statusCode: 404,
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur introuvable',
        }),
      );

      await expectApiError(() => getUser(userId), 404, 'USER_NOT_FOUND');
    });
  });

  describe('updateUser', () => {
    it('rejette la mise à jour si aucun champ n est défini avant d appeler le réseau', async () => {
      const emptyInput: UpdateAdminUserRequest = { name: undefined };
      await expect(updateUser(userId, emptyInput)).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejette la mise à jour avec un nom vide avant d appeler le réseau', async () => {
      const invalidInput: UpdateAdminUserRequest = { name: '' };
      await expect(updateUser(userId, invalidInput)).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('envoie une requête PATCH avec le corps JSON et le jeton CSRF, et valide la réponse', async () => {
      const updateInput: UpdateAdminUserRequest = {
        name: 'Ada King',
        role: Role.EDITOR,
        active: false,
        uiLang: 'ar',
      };
      const updatedUser: AdminUser = {
        ...sampleUser,
        name: 'Ada King',
        role: Role.EDITOR,
        active: false,
        uiLang: 'ar',
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, updatedUser));

      const result = await updateUser(userId, updateInput);

      expect(result).toEqual(updatedUser);
      const call = lastCall();
      expect(call?.url).toBe(`/api/v1/admin/users/${userId}`);
      expect(call?.method).toBe('PATCH');
      expect(call?.headers.get('Content-Type')).toBe('application/json');
      expectCsrfHeader();
      expect(lastCallJson()).toEqual(updateInput);
    });

    it('rejette une réponse de mise à jour non conforme', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: userId, active: 'not-a-boolean' }));

      await expect(updateUser(userId, { name: 'Nouveau' })).rejects.toThrow();
    });

    it('convertit une réponse HTTP 403 en ApiError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Accès refusé',
        }),
      );

      await expectApiError(
        () => updateUser(userId, { name: 'Ada King' }),
        403,
        'FORBIDDEN',
      );
    });

    it('convertit une réponse HTTP 409 en ApiError avec son code d erreur', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, {
          statusCode: 409,
          code: 'LAST_ADMIN_CANNOT_BE_DISABLED',
          message: 'Impossible de désactiver le dernier administrateur',
        }),
      );

      await expectApiError(
        () => updateUser(userId, { active: false }),
        409,
        'LAST_ADMIN_CANNOT_BE_DISABLED',
      );
    });
  });

  describe('setUserHotels', () => {
    it('rejette l assignation d hôtels si un identifiant n est pas un UUID valide sans appel réseau', async () => {
      await expect(setUserHotels(userId, ['not-a-uuid'])).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('envoie une requête PUT avec le corps { hotelIds } et le jeton CSRF, et valide la réponse', async () => {
      const assignedUser: AdminUser = {
        ...sampleUser,
        hotelIds: [hotelId1, hotelId2],
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, assignedUser));

      const result = await setUserHotels(userId, [hotelId1, hotelId2]);

      expect(result).toEqual(assignedUser);
      const call = lastCall();
      expect(call?.url).toBe(`/api/v1/admin/users/${userId}/hotels`);
      expect(call?.method).toBe('PUT');
      expect(call?.headers.get('Content-Type')).toBe('application/json');
      expectCsrfHeader();
      expect(lastCallJson()).toEqual({ hotelIds: [hotelId1, hotelId2] });
    });

    it('accepte une liste d hôtels vide', async () => {
      const userWithoutHotels: AdminUser = {
        ...sampleUser,
        hotelIds: [],
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, userWithoutHotels));

      const result = await setUserHotels(userId, []);

      expect(result).toEqual(userWithoutHotels);
      expect(lastCallJson()).toEqual({ hotelIds: [] });
    });

    it('rejette une réponse non conforme du serveur', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { hotelIds: 'not-an-array' }));

      await expect(setUserHotels(userId, [hotelId1])).rejects.toThrow();
    });

    it('convertit une réponse HTTP 403 en ApiError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Accès refusé',
        }),
      );

      await expectApiError(() => setUserHotels(userId, [hotelId1]), 403, 'FORBIDDEN');
    });

    it('convertit une réponse HTTP 409 en ApiError avec son code d erreur', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, {
          statusCode: 409,
          code: 'HOTEL_NOT_FOUND',
          message: 'Un ou plusieurs hôtels sont introuvables',
        }),
      );

      await expectApiError(
        () => setUserHotels(userId, [hotelId1]),
        409,
        'HOTEL_NOT_FOUND',
      );
    });
  });
});
