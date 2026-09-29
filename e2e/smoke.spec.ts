import { expect, test, type Route } from '@playwright/test';
import { resources } from '@xplor/i18n';

const fr = resources.fr;

test("la page / s'affiche et html lang est fr", async ({ page }) => {
  await page.route(
    (url) => url.pathname === '/api/v1/auth/me',
    async (route) => {
      await fulfillUnauthenticated(route);
    },
  );
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: fr.common.appName, exact: true })).toBeVisible();
});

async function fulfillUnauthenticated(route: Route): Promise<void> {
  const request = route.request();
  const { pathname } = new URL(request.url());
  if (request.method() !== 'GET') {
    throw new Error(`requête API non prévue : ${request.method()} ${pathname}`);
  }
  await route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'UNAUTHENTICATED' }),
  });
}
