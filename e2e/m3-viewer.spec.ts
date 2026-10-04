import { expect, test, Page } from '@playwright/test';
import { resources } from '@xplor/i18n';
import { ensureReadyPanoramas } from './helpers/panoramas.js';

async function readPost<T>(
  page: Page,
  pattern: RegExp,
  postAfter: () => Promise<void>
): Promise<T> {
  const responsePromise = page.waitForResponse(
    (candidate) =>
      candidate.url().match(pattern) !== null &&
      candidate.request().method() === 'POST' &&
      candidate.status() >= 200 &&
      candidate.status() < 300
  );
  await postAfter();
  const response = await responsePromise;
  return response.json() as Promise<T>;
}

test.describe('M3 F-40/F-30 : page publique (Viewer)', () => {
  test('Affiche correctement une visite partagée et configure la langue', async ({ page }) => {
    test.setTimeout(120000);
    // Use admin page to create data
    await page.goto('http://localhost:5173/');
    
    const email = 'admin@xplor.local';
    const password = process.env.SEED_DEFAULT_PASSWORD || 'xplor-seed-dev-2026';

    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe').fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Administrateur').first()).toBeVisible();

    await ensureReadyPanoramas(page, 1);

    await page.getByRole('link', { name: 'Visites', exact: true }).click();
    await page.getByRole('button', { name: 'Nouvelle visite' }).click();

    const uniqueSuffix = Date.now().toString();
    await page.getByRole('textbox', { name: 'Titre' }).fill(`Visite M3 ${uniqueSuffix}`);
    await page.getByRole('textbox', { name: 'Résumé' }).fill('Résumé M3');
    await page.getByLabel('Ville').selectOption({ index: 1 });
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByLabel('Vignette').selectOption({ index: 1 });
    await page.getByTestId('submit-tour-btn').click();
    await expect(page.getByRole('heading', { name: 'Détails de la visite' })).toBeVisible();
    
    const tourUrl = page.url(); 

    // Add 1 scene
    await page.getByRole('button', { name: 'Ajouter une scène' }).click();
    await page.getByRole('textbox', { name: 'Titre' }).fill(`Scène M3`);
    const panoramaSelect = page.getByLabel('Panorama');
    await expect(panoramaSelect).toBeVisible();
    await expect.poll(async () => {
      const texts = await panoramaSelect.locator('option').allInnerTexts();
      return texts.filter((text) => text.trim().endsWith('Prêt')).length;
    }, { timeout: 10000 }).toBeGreaterThanOrEqual(1);

    const allTexts = await panoramaSelect.locator('option').allInnerTexts();
    const readyIndices = allTexts
      .map((text, index) => ({ text, index }))
      .filter(({ text }) => text.trim().endsWith('Prêt'))
      .map(({ index }) => index);

    await panoramaSelect.selectOption({ index: readyIndices[0] });

    await readPost(page, /\/api\/v1\/admin\/tours\/[a-f0-9-]+\/scenes$/, async () => {
      await page.getByTestId('submit-scene-btn').click();
    });
    
    await expect(page.getByRole('heading', { name: 'Modifier' })).toBeVisible();
    await page.goto(tourUrl);
    await expect(page.getByRole('heading', { name: 'Détails de la visite' })).toBeVisible();

    // Set start scene
    const row1 = page.locator('tr').filter({ hasText: `Scène M3` });
    await row1.locator('button').filter({ hasText: 'départ' }).click();
    await expect(row1.getByText('Scène de départ')).toBeVisible();

    // Validate
    await readPost(page, /\/api\/v1\/admin\/tours\/[a-f0-9-]+\/validate$/, async () => {
      await page.getByTestId('validate-tour-btn').click();
    });
    await expect(page.getByTestId('validation-success')).toBeVisible();

    // Publish
    const publishRes = await readPost<{ shareToken: string }>(page, /\/api\/v1\/admin\/tours\/[a-f0-9-]+\/publish$/, async () => {
      await page.getByTestId('publish-tour-btn').click();
    });
    await expect(page.getByTestId('tour-status-published')).toBeVisible();

    const token = publishRes.shareToken;

    // Test Viewer
    const responsePromise = page.waitForResponse(
      (candidate) =>
        candidate.url().includes(`/api/v1/public/tours/${token}`) &&
        candidate.request().method() === 'GET'
    );
    await page.goto(`http://localhost:5174/v/${token}?lang=fr`);
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'fr');
    await expect(html).toHaveAttribute('dir', 'ltr');

    const psvContainer = page.locator('.psv-container');
    await expect(psvContainer).toBeVisible();

    const statusDiv = page.locator('#status');
    await expect(statusDiv).toBeHidden();

    const controls = page.locator('#controls');
    await expect(controls).toBeVisible();

    const backBtn = page.getByRole('button', { name: resources.fr.viewer.back });
    await expect(backBtn).toBeHidden();
  });

  test('Affiche un message d\'erreur pour un jeton inconnu', async ({ page }) => {
    const responsePromise = page.waitForResponse(r => r.url().includes('/api/v1/public/tours/jetoninconnu123'));
    await page.goto('http://localhost:5174/v/jetoninconnu123?lang=fr');
    await responsePromise;
    const notFoundText = resources.fr.viewer.notFound;
    const statusDiv = page.locator('#status');
    await expect(statusDiv).toBeVisible();
    await expect(statusDiv).toHaveText(notFoundText);
  });
});
