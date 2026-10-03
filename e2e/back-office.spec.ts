import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';
import { dir, resources } from '@xplor/i18n';
import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  MeResponseSchema,
  Role,
  type MeResponse,
} from '@xplor/shared';

const fr = resources.fr;
const ar = resources.ar;

const loginArScreenshot = resolve(process.cwd(), 'docs/screenshots/login-ar.png');

const email = 'admin@xplor.local';
const password = 'mot-de-passe-e2e';

const profileBody = {
  id: 'user-e2e-1',
  email,
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-e2e-token',
} as const;

type LoginOutcome = 'ok' | 'invalid-credentials' | 'locked';

type ApiDouble = {
  calls: string[];
  profile: MeResponse;
  logoutCsrf: () => string | undefined;
};

const ROLE_LABEL = {
  [Role.ADMIN]: fr.auth.role.ADMIN,
  [Role.EDITOR]: fr.auth.role.EDITOR,
  [Role.HOTEL_MANAGER]: fr.auth.role.HOTEL_MANAGER,
  [Role.PARTNER]: fr.auth.role.PARTNER,
} as const satisfies Record<Role, string>;

test('une connexion réussie affiche le nom et le rôle, puis la déconnexion renvoie à la connexion', async ({
  page,
}) => {
  const api = await installApi(page, 'ok');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: fr.auth.login.title, exact: true })).toBeVisible();

  await submitLogin(page);

  await expect(page.getByRole('banner').getByText(api.profile.name, { exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByText(ROLE_LABEL[api.profile.role])).toBeVisible();
  await expect(page.getByRole('heading', { name: fr.auth.login.title, exact: true })).toHaveCount(
    0,
  );

  await page.getByRole('button', { name: fr.auth.logout, exact: true }).click();

  await expect(page.getByRole('heading', { name: fr.auth.login.title, exact: true })).toBeVisible();
  expect(api.logoutCsrf()).toBe(api.profile.csrfToken);
});

test('un 401 INVALID_CREDENTIALS affiche auth.login.error', async ({ page }) => {
  await installApi(page, 'invalid-credentials');
  await page.goto('/');
  await submitLogin(page);

  await expect(page.getByRole('alert')).toHaveText(fr.auth.login.error);
});

test('un 423 ACCOUNT_LOCKED affiche auth.login.locked', async ({ page }) => {
  await installApi(page, 'locked');
  await page.goto('/');
  await submitLogin(page);

  await expect(page.getByRole('alert')).toHaveText(fr.auth.login.locked);
});

test('la page /forgot affiche le message de confirmation', async ({ page }) => {
  await installApi(page, 'ok');
  await page.goto('/forgot');
  await expect(
    page.getByRole('heading', { name: fr.auth.forgot.title, exact: true }),
  ).toBeVisible();

  await page.getByLabel(fr.auth.forgot.email, { exact: true }).fill(email);
  await page.getByRole('button', { name: fr.auth.forgot.submit, exact: true }).click();

  await expect(page.getByRole('status')).toHaveText(fr.auth.forgot.sent);
});

test('deux mots de passe différents sur /reset/abc affichent une erreur sans appel /api', async ({
  page,
}) => {
  const api = await installApi(page, 'ok');
  await page.goto('/reset/abc');
  await expect(
    page.getByRole('heading', { name: fr.auth.setPassword.titleReset, exact: true }),
  ).toBeVisible();
  await expect.poll(() => api.calls.includes('GET /api/v1/auth/me')).toBe(true);

  await page.getByLabel(fr.auth.setPassword.password, { exact: true }).fill('a'.repeat(12));
  await page.getByLabel(fr.auth.setPassword.confirm, { exact: true }).fill('b'.repeat(12));
  await page.getByRole('button', { name: fr.auth.setPassword.submit, exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText(fr.auth.setPassword.mismatch);
  expect(api.calls.filter((call) => call !== 'GET /api/v1/auth/me')).toEqual([]);
});

test('?lang=ar pose dir=rtl et lang=ar, et enregistre la capture de connexion', async ({
  page,
}) => {
  await installApi(page, 'ok');
  await page.goto('/?lang=ar');

  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', dir('ar'));
  await expect(page.getByRole('heading', { name: ar.auth.login.title, exact: true })).toBeVisible();

  mkdirSync(dirname(loginArScreenshot), { recursive: true });
  await page.screenshot({ path: loginArScreenshot, fullPage: true });
});

async function submitLogin(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: fr.auth.login.title, exact: true })).toBeVisible();
  await page.getByLabel(fr.auth.login.email, { exact: true }).fill(email);
  await page.getByLabel(fr.auth.login.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: fr.auth.login.submit, exact: true }).click();
}

async function installApi(page: Page, loginOutcome: LoginOutcome): Promise<ApiDouble> {
  const calls: string[] = [];
  const profile = MeResponseSchema.parse(profileBody);
  let csrfOnLogout: string | undefined;

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const { pathname } = new URL(request.url());
      const method = request.method();
      calls.push(`${method} ${pathname}`);
      await fulfill(route, method, pathname, loginOutcome, profile, (csrf) => {
        csrfOnLogout = csrf;
      });
    },
  );

  return {
    calls,
    profile,
    logoutCsrf: () => csrfOnLogout,
  };
}

async function fulfill(
  route: Route,
  method: string,
  pathname: string,
  loginOutcome: LoginOutcome,
  profile: MeResponse,
  onLogout: (csrf: string | undefined) => void,
): Promise<void> {
  const request = route.request();

  if (method === 'GET' && pathname === '/api/v1/auth/me') {
    await route.fulfill({ status: 401 });
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/auth/login') {
    LoginRequestSchema.parse(parseJson(request.postData()));
    if (loginOutcome === 'ok') {
      await fulfillJson(route, 200, MeResponseSchema.parse(profile));
      return;
    }
    if (loginOutcome === 'invalid-credentials') {
      await fulfillJson(route, 401, codedError(401, 'INVALID_CREDENTIALS'));
      return;
    }
    await fulfillJson(route, 423, codedError(423, 'ACCOUNT_LOCKED'));
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/auth/logout') {
    onLogout(request.headers()['x-csrf-token']);
    await route.fulfill({ status: 204 });
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/auth/password/forgot') {
    ForgotPasswordRequestSchema.parse(parseJson(request.postData()));
    await route.fulfill({ status: 202 });
    return;
  }

  if (method === 'GET' && pathname === '/api/v1/admin/tours') {
    await fulfillJson(route, 200, { items: [], total: 0, page: 1, pageSize: 1 });
    return;
  }

  throw new Error(`requête API non prévue : ${method} ${pathname}`);
}

function codedError(statusCode: 401 | 423, code: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED') {
  return { statusCode, code, message: code };
}

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function parseJson(raw: string | null): unknown {
  if (raw === null) {
    throw new Error('corps JSON absent');
  }
  return JSON.parse(raw) as unknown;
}
