import { expect, test } from '@playwright/test';
import { resources } from '@xplor/i18n';
import { SEED_TOURS } from '../apps/api/src/seed/seed-tours.js';

const DEMO_TOUR = SEED_TOURS.find((t) => t.publicShare);

test.describe('M3 F-40/F-30 : page publique (Viewer)', () => {
  test.use({ baseURL: 'http://127.0.0.1:5174' });

  test('Affiche correctement une visite partagée et configure la langue', async ({ page }) => {
    expect(DEMO_TOUR).toBeDefined();
    if (!DEMO_TOUR) throw new Error('Aucune visite de démonstration publiée dans le seed');
    
    const token = DEMO_TOUR.shareToken;

    // (2) l'appel réseau GET /api/v1/public/tours/<jeton> répond 200
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/public/tours/${token}`) &&
        response.request().method() === 'GET'
    );

    // On charge la visite en français
    await page.goto(`/v/${token}?lang=fr`);
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // (4) <html> a dir="ltr" et lang="fr"
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'fr');
    await expect(html).toHaveAttribute('dir', 'ltr');

    // (1) le conteneur de Photo Sphere Viewer (.psv-container) devient visible
    const psvContainer = page.locator('.psv-container');
    await expect(psvContainer).toBeVisible();

    // aucun message d'erreur de chargement
    const statusDiv = page.locator('#status');
    await expect(statusDiv).toBeHidden();

    // la barre de contrôles est présente
    const controls = page.locator('#controls');
    await expect(controls).toBeVisible();

    // le bouton Retour est masqué
    const backBtn = page.getByRole('button', { name: resources.fr.viewer.back });
    await expect(backBtn).toBeHidden();
  });

  test('Affiche un message d\'erreur pour un jeton inconnu', async ({ page }) => {
    // (3) /v/jetoninconnu123 affiche le message d'erreur de chargement traduit en français
    await page.goto('/v/jetoninconnu123?lang=fr');

    const notFoundText = resources.fr.viewer.notFound;
    const statusDiv = page.locator('#status');
    
    await expect(statusDiv).toBeVisible();
    await expect(statusDiv).toHaveText(notFoundText);
  });
});
