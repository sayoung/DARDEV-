import { expect, test } from '@playwright/test';

test("la page / s'affiche et html lang est fr", async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: 'Xplor' })).toBeVisible();
});
