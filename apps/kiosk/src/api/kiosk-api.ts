import {
  KioskEnrollRequestSchema,
  KioskEnrollResponseSchema,
  KioskHeartbeatRequestSchema,
  KioskHeartbeatResponseSchema,
  KioskManifestSchema,
  type KioskEnrollRequest,
  type KioskEnrollResponse,
  type KioskHeartbeatRequest,
  type KioskHeartbeatResponse,
  type KioskManifest,
} from '@xplor/shared';

export type KioskApiErrorCode =
  | 'UNAUTHORIZED'
  | 'KIOSK_DISABLED'
  | 'NETWORK'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE';

export class KioskApiError extends Error {
  constructor(
    readonly code: KioskApiErrorCode,
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'KioskApiError';
  }
}

export async function enroll(
  fetchFn: typeof fetch,
  baseUrl: string,
  code: string,
  deviceInfo: KioskEnrollRequest['deviceInfo'],
): Promise<KioskEnrollResponse> {
  const body = KioskEnrollRequestSchema.parse({ code, deviceInfo });
  return requestJson(
    fetchFn,
    apiUrl(baseUrl, '/api/v1/kiosk/enroll'),
    KioskEnrollResponseSchema,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function fetchManifest(
  fetchFn: typeof fetch,
  baseUrl: string,
  token: string,
): Promise<KioskManifest> {
  return requestJson(fetchFn, apiUrl(baseUrl, '/api/v1/kiosk/manifest'), KioskManifestSchema, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendHeartbeat(
  fetchFn: typeof fetch,
  baseUrl: string,
  token: string,
  body: KioskHeartbeatRequest,
): Promise<KioskHeartbeatResponse> {
  const validBody = KioskHeartbeatRequestSchema.parse(body);
  return requestJson(
    fetchFn,
    apiUrl(baseUrl, '/api/v1/kiosk/heartbeat'),
    KioskHeartbeatResponseSchema,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(validBody),
    },
  );
}

async function requestJson<T>(
  fetchFn: typeof fetch,
  url: string,
  schema: { parse(value: unknown): T },
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetchFn(url, { ...init, headers });
  } catch (cause) {
    throw new KioskApiError('NETWORK', 'Impossible de joindre le serveur kiosque.', undefined, {
      cause,
    });
  }

  if (!response.ok) {
    const code = response.status === 401
      ? 'UNAUTHORIZED'
      : response.status === 403
        ? 'KIOSK_DISABLED'
        : 'HTTP_ERROR';
    throw new KioskApiError(code, `Erreur HTTP ${String(response.status)}.`, response.status);
  }

  try {
    return schema.parse(await response.json());
  } catch (cause) {
    throw new KioskApiError('INVALID_RESPONSE', 'Réponse invalide du serveur kiosque.', response.status, {
      cause,
    });
  }
}

function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}
