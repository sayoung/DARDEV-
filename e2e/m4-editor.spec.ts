import { expect, test, Page } from '@playwright/test';
import { resources } from '@xplor/i18n';
import { ensureReadyPanoramas } from './helpers/panoramas.js';

async function readPost(
  page: Page,
  pattern: RegExp,
  postAfter: () => Promise<void>
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (candidate) =>
      candidate.url().match(pattern) !== null &&
      candidate.request().method() === 'POST' &&
      candidate.status() >= 200 &&
      candidate.status() < 300
  );
  await postAfter();
  await responsePromise;
}

test.describe('M4 F-20 à F-25 : Éditeur (Carte des liens et Éditeur 360)', () => {
  test('Affiche la carte des liens avec les scènes et l\'éditeur 360', async ({ page }) => {
    test.setTimeout(120000);
    
    // 1. Connexion admin
    await page.goto('http://localhost:5173/');
    
    const email = 'admin@xplor.local';
    const password = process.env.SEED_DEFAULT_PASSWORD || 'xplor-seed-dev-2026';

    await page.getByLabel(resources.fr.auth.login.email).fill(email);
    await page.getByLabel(resources.fr.auth.login.password).fill(password);
    await page.getByRole('button', { name: resources.fr.auth.login.submit }).click();
    await expect(page.getByText(resources.fr.auth.role.ADMIN).first()).toBeVisible();

    // 2. Assurer 2 panoramas prêts
    await ensureReadyPanoramas(page, 2);

    // 3. Création d'une visite avec titre unique
    await page.getByRole('link', { name: resources.fr.nav.tours, exact: true }).click();
    await page.getByRole('button', { name: resources.fr.catalog.tour.actions.new }).click();

    const uniqueSuffix = Date.now().toString();
    const tourTitle = `Visite M4 ${uniqueSuffix}`;
    await page.getByRole('textbox', { name: resources.fr.tour.form.title }).fill(tourTitle);
    await page.getByRole('textbox', { name: resources.fr.tour.form.summary }).fill('Résumé M4');
    await page.getByLabel(resources.fr.tour.form.cityId).selectOption({ index: 1 });
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByLabel(resources.fr.tour.form.coverAssetId).selectOption({ index: 1 });
    await page.getByTestId('submit-tour-btn').click();
    await expect(page.getByRole('heading', { name: resources.fr.page.tourDetail.title })).toBeVisible();
    
    const tourUrl = page.url(); 

    // 4. Ajouter 2 scènes
    for (let i = 1; i <= 2; i++) {
      await page.getByRole('button', { name: resources.fr.catalog.scene.actions.add }).click();
      await page.getByRole('textbox', { name: resources.fr.catalog.scene.fields.title }).fill(`Scène M4 - ${String(i)}`);
      
      const panoramaSelect = page.getByLabel(resources.fr.catalog.scene.fields.panorama);
      await expect(panoramaSelect).toBeVisible();
      
      // Attendre que des options "Prêt" soient disponibles
      await expect.poll(async () => {
        const texts = await panoramaSelect.locator('option').allInnerTexts();
        return texts.filter((text) => text.trim().endsWith(resources.fr.catalog.asset.status.READY)).length;
      }, { timeout: 10000 }).toBeGreaterThanOrEqual(2);

      const allTexts = await panoramaSelect.locator('option').allInnerTexts();
      const readyIndices = allTexts
        .map((text, index) => ({ text, index }))
        .filter(({ text }) => text.trim().endsWith(resources.fr.catalog.asset.status.READY))
        .map(({ index }) => index);

      // On sélectionne le premier panorama prêt pour la scène 1, et le deuxième pour la scène 2 si possible
      await panoramaSelect.selectOption({ index: readyIndices[i > 1 ? 1 : 0] || readyIndices[0] });

      await readPost(page, /\/api\/v1\/admin\/tours\/[a-f0-9-]+\/scenes$/, async () => {
        await page.getByTestId('submit-scene-btn').click();
      });
      
      await expect(page.getByRole('heading', { name: resources.fr.catalog.edit })).toBeVisible();
      await page.goto(tourUrl);
      await expect(page.getByRole('heading', { name: resources.fr.page.tourDetail.title })).toBeVisible();
    }

    // Définir la première scène comme départ si non fait automatiquement
    const row1 = page.locator('tr').filter({ hasText: `Scène M4 - 1` });
    if (await row1.locator('button').filter({ hasText: 'départ' }).isVisible()) {
      await row1.locator('button').filter({ hasText: 'départ' }).click();
      await expect(row1.getByText(resources.fr.catalog.scene.startBadge)).toBeVisible();
    }

    // 5. Vérifier la page de détail
    // Titre "Carte des liens"
    await expect(page.getByText(resources.fr.catalog.tours.linkMap.title)).toBeVisible();
    
    // Graphe contient 2 nœuds
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Un libellé commence par "Départ :"
    const startNodeText = resources.fr.catalog.tours.linkMap.start;
    const startNodeLocator = page.locator('.react-flow__node').filter({ hasText: startNodeText });
    await expect(startNodeLocator).toBeVisible();

    // Bouton "Tester la visite" est visible
    const testTourBtn = page.getByRole('button', { name: resources.fr.catalog.tours.preview.open });
    await expect(testTourBtn).toBeVisible();

    // 6. Ouvrir une scène
    await page.getByRole('link', { name: resources.fr.catalog.edit }).first().click();

    // Cliquer sur l'onglet "Éditeur 360"
    await page.getByRole('tab', { name: resources.fr.catalog.scenes.tabs.editor }).click();

    // Vérifier le texte
    await expect(page.getByText(resources.fr.catalog.hotspots.editor.hint)).toBeVisible();
  });
});
