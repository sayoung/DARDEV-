import {
  LoginRequestSchema,
  MeResponseSchema,
  type LoginRequest,
  type MeResponse,
} from '@xplor/shared';

/** Méthodes sans effet de bord : pas d'en-tête CSRF (même règle que `CsrfGuard`). */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS';
const ACCOUNT_LOCKED = 'ACCOUNT_LOCKED';

let csrfToken: string | undefined;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined) {
    super(code ?? `HTTP ${String(status)}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isInvalidCredentials(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === INVALID_CREDENTIALS;
}

export function isAccountLocked(error: unknown): boolean {
  return error instanceof ApiError && error.status === 423 && error.code === ACCOUNT_LOCKED;
}

/** Remet à zéro le jeton CSRF (tests, et après un logout réussi). */
export function clearCsrfToken(): void {
  csrfToken = undefined;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (!SAFE_METHODS.has(method) && csrfToken !== undefined) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  return fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });
}

export async function login(input: LoginRequest): Promise<MeResponse> {
  const body = LoginRequestSchema.parse(input);
  const response = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readMe(response);
}

export async function fetchCurrentUser(): Promise<MeResponse> {
  return readMe(await apiFetch('/api/v1/auth/me'));
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/api/v1/auth/logout', { method: 'POST' });
  if (!response.ok) {
    throw await toApiError(response);
  }
  clearCsrfToken();
}

async function readMe(response: Response): Promise<MeResponse> {
  if (!response.ok) {
    throw await toApiError(response);
  }
  const profile = MeResponseSchema.parse(await readJson(response));
  csrfToken = profile.csrfToken;
  return profile;
}

async function toApiError(response: Response): Promise<ApiError> {
  return new ApiError(response.status, await readErrorCode(response));
}

async function readJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    return codeFromBody(await readJson(response));
  } catch {
    return undefined;
  }
}

function codeFromBody(body: unknown): string | undefined {
  const direct = directCode(body);
  if (direct !== undefined) {
    return direct;
  }
  if (typeof body === 'object' && body !== null && 'error' in body) {
    return directCode(body.error);
  }
  return undefined;
}

function directCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('code' in body)) {
    return undefined;
  }
  const code = body.code;
  if (typeof code === 'string' && code.length > 0) {
    return code;
  }
  return undefined;
}
