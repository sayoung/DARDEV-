/**
 * Fumée CI de l'API déjà démarrée (NF-08, D-59).
 * Aucune dépendance npm. N'affiche jamais SEED_DEFAULT_PASSWORD.
 * Premier écart : message sur stderr et code 1.
 */
/* global AbortSignal, console, fetch, process, setTimeout */

const BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const EMAIL = 'admin@xplor.local';
const LIMIT_MS = 60_000;
const PROBE_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 20_000;

function redact(text) {
  const secret = process.env.SEED_DEFAULT_PASSWORD;
  if (secret === undefined || secret === '') {
    return text;
  }
  return text.split(secret).join('[redacted]');
}

function fail(message) {
  const error = new Error(redact(message));
  error.name = 'SmokeFailure';
  throw error;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

function checkValue(checks, key) {
  if (!isRecord(checks)) {
    return 'absent';
  }
  const value = checks[key];
  return typeof value === 'string' ? value : 'absent';
}

/**
 * @param {number} timeoutMs
 * @returns {Promise<string | null>} null lorsque /api/health est conforme.
 */
async function probeHealth(timeoutMs) {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return `statut ${String(response.status)}, corps non JSON`;
    }
    const checks = isRecord(body) ? body.checks : undefined;
    const db = checkValue(checks, 'db');
    const redis = checkValue(checks, 'redis');
    const storage = checkValue(checks, 'storage');
    if (response.status === 200 && db === 'ok' && redis === 'ok' && storage === 'ok') {
      return null;
    }
    return `statut ${String(response.status)}, db=${db}, redis=${redis}, storage=${storage}`;
  } catch (error) {
    return error instanceof Error ? error.message : 'erreur réseau';
  }
}

async function waitForHealth() {
  const started = Date.now();
  let detail = 'aucune réponse';
  while (Date.now() - started < LIMIT_MS) {
    const remaining = LIMIT_MS - (Date.now() - started);
    detail = await probeHealth(Math.min(PROBE_TIMEOUT_MS, remaining));
    if (detail === null) {
      return;
    }
    const after = LIMIT_MS - (Date.now() - started);
    if (after <= 0) {
      break;
    }
    await delay(Math.min(1_000, after));
  }
  fail(`GET /api/health n'a pas atteint 200 avec db, redis et storage à ok en 60 s (${detail}).`);
}

async function assertOpenApi() {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/v1/openapi.json`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur réseau';
    fail(`GET /api/v1/openapi.json inaccessible (${message}).`);
  }
  if (response.status !== 200) {
    const text = await response.text();
    fail(
      `GET /api/v1/openapi.json : attendu 200, reçu ${String(response.status)}. ${text.slice(0, 300)}`,
    );
  }
}

function readSessionCookie(response) {
  if (typeof response.headers.getSetCookie !== 'function') {
    fail('Set-Cookie illisible : headers.getSetCookie est absent de ce Node.');
  }
  const lines = response.headers.getSetCookie();
  for (const line of lines) {
    const first = line.split(';', 1)[0] ?? '';
    const separator = first.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const name = first.slice(0, separator).trim();
    const value = first.slice(separator + 1).trim();
    if (name === 'xplor_sid' && value.length > 0) {
      return value;
    }
  }
  return null;
}

async function login(password) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: EMAIL, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur réseau';
    fail(`POST /api/v1/auth/login inaccessible (${message}).`);
  }
  if (response.status !== 200) {
    const text = await response.text();
    fail(
      `POST /api/v1/auth/login : attendu 200, reçu ${String(response.status)}. ${text.slice(0, 300)}`,
    );
  }
  const sessionId = readSessionCookie(response);
  if (sessionId === null) {
    fail('POST /api/v1/auth/login a répondu 200 sans cookie xplor_sid.');
  }
  return sessionId;
}

async function assertMe(sessionId) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { cookie: `xplor_sid=${sessionId}`, accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur réseau';
    fail(`GET /api/v1/auth/me inaccessible (${message}).`);
  }
  if (response.status !== 200) {
    const text = await response.text();
    fail(
      `GET /api/v1/auth/me : attendu 200, reçu ${String(response.status)}. ${text.slice(0, 300)}`,
    );
  }
}

async function main() {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password === '') {
    fail('SEED_DEFAULT_PASSWORD est absent.');
  }
  await waitForHealth();
  await assertOpenApi();
  const sessionId = await login(password);
  await assertMe(sessionId);
  console.log('API smoke : health, openapi, login et me sont conformes.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Échec inattendu du smoke API';
  const alreadyRedacted = error instanceof Error && error.name === 'SmokeFailure';
  console.error(alreadyRedacted ? message : redact(message));
  process.exit(1);
});
