import { expect, test, Page } from '@playwright/test';

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

test.describe('Livrable M1 : création de visite', () => {
  test('Créer une visite complète avec scènes, hotspots, validation et publication', async ({
    page,
  }) => {
    test.setTimeout(60000);
    // 1. Connexion en tant qu'admin
    await page.goto('/');
    
    const email = 'admin@xplor.local';
    const password = process.env.SEED_DEFAULT_PASSWORD || 'xplor-seed-dev-2026';

    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe').fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Vérification de la connexion
    await expect(page.getByText('Administrateur').first()).toBeVisible();

    // 2. Navigation vers /tours/new
    await page.getByRole('link', { name: 'Visites' }).click();
    await page.getByRole('button', { name: 'Nouvelle visite' }).click();

    // 3. Création d'une visite
    await page.getByRole('textbox', { name: 'Titre' }).fill('Visite de démonstration M1');
    await page.getByRole('textbox', { name: 'Résumé' }).fill('Résumé de la visite de démonstration');
    await page.locator('select').nth(0).selectOption({ index: 1 }); // Ville
    
    // Pour les catégories (checkbox) :
    await page.locator('input[type="checkbox"]').first().check();

    // Vignette (AssetPicker, c'est un <select>)
    await page.locator('select').nth(1).selectOption({ index: 1 });

    await page.getByTestId('submit-tour-btn').click();
    
    // Le routeur devrait rediriger vers /tours/:id
    await expect(page.getByRole('heading', { name: 'Détails de la visite' })).toBeVisible();
    
    const tourUrl = page.url(); // Save the precise tour URL

    // 4. Ajout de 3 scènes
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: 'Ajouter une scène' }).click();
      await page.getByRole('textbox', { name: 'Titre' }).fill(`Scène ${String(i)} M1`);
      
      const panoramaSelect = page.locator('select').first();
      await panoramaSelect.selectOption({ index: i }); // On prend les 3 premiers panoramas du seed

      await readPost(
        page,
        /\/api\/v1\/admin\/tours\/[a-f0-9-]+\/scenes$/,
        async () => {
          await page.getByTestId('submit-scene-btn').click();
        }
      );
      
      // On s'assure que la création a réussi en attendant la navigation vers la page d'édition
      await expect(page.getByRole('heading', { name: 'Modifier' })).toBeVisible();

      // On navigue de nouveau vers la visite via l'URL directe
      await page.goto(tourUrl);
      
      // On s'assure qu'on est revenu sur la page de détail
      await expect(page.getByRole('heading', { name: 'Détails de la visite' })).toBeVisible();
    }

    // 5. Définition de la scène 1 comme scène de départ
    const row1 = page.locator('tr').filter({ hasText: 'Scène 1 M1' });
    await row1.locator('button').filter({ hasText: 'départ' }).click();
    await expect(row1.getByText('Scène de départ')).toBeVisible();

    // 6. Création de 2 hotspots sur la scène 1
    await row1.locator('button').filter({ hasText: 'Modifier' }).click();
    await expect(page.getByRole('heading', { name: 'Modifier' })).toBeVisible();
    
    const sceneEditUrl = page.url(); 
    await page.goto(sceneEditUrl + '/hotspots');
    
    // Hotspot 1: SCENE_LINK vers scène 2
    await page.getByRole('button', { name: 'Ajouter un hotspot' }).click();
    await page.locator('select').nth(0).selectOption({ index: 0 }); // SCENE_LINK
    await page.getByRole('textbox', { name: 'Libellé' }).fill('Vers la scène 2');
    await page.locator('input[type="number"]').nth(0).fill('1.2'); // yaw
    await page.locator('input[type="number"]').nth(1).fill('0'); // pitch
    // Sélectionner la scène cible (index 2 = Scène 2 M1 si on compte l'option vide)
    await page.locator('select').nth(2).selectOption({ label: 'Scène 2 M1' });
    
    await readPost(
      page,
      /\/api\/v1\/admin\/scenes\/[a-f0-9-]+\/hotspots$/,
      async () => {
        await page.getByTestId('submit-hotspot-btn').click();
      }
    );
    await expect(page.getByRole('heading', { name: 'Hotspots de la scène' })).toBeVisible();

    // Hotspot 2: INFO
    await page.getByRole('button', { name: 'Ajouter un hotspot' }).click();
    await page.locator('select').nth(0).selectOption({ index: 2 }); // INFO
    await page.getByRole('textbox', { name: 'Libellé' }).fill('Info M1');
    await page.getByRole('textbox', { name: 'Texte' }).fill('Ceci est une description détaillée en français.');
    
    await readPost(
      page,
      /\/api\/v1\/admin\/scenes\/[a-f0-9-]+\/hotspots$/,
      async () => {
        await page.getByTestId('submit-hotspot-btn').click();
      }
    );
    await expect(page.getByRole('heading', { name: 'Hotspots de la scène' })).toBeVisible();

    // Retour à la visite via l'URL directe
    await page.goto(tourUrl);

    // Aller sur Scène 2 pour la lier à Scène 3
    const row2 = page.locator('tr').filter({ hasText: 'Scène 2 M1' });
    await row2.locator('button').filter({ hasText: 'Modifier' }).click();
    await page.goto(page.url() + '/hotspots');
    await page.getByRole('button', { name: 'Ajouter un hotspot' }).click();
    await page.locator('select').nth(0).selectOption({ index: 0 }); // SCENE_LINK
    await page.getByRole('textbox', { name: 'Libellé' }).fill('Vers la scène 3');
    await page.locator('select').nth(2).selectOption({ label: 'Scène 3 M1' });
    await readPost(
      page,
      /\/api\/v1\/admin\/scenes\/[a-f0-9-]+\/hotspots$/,
      async () => {
        await page.getByTestId('submit-hotspot-btn').click();
      }
    );
    await expect(page.getByRole('heading', { name: 'Hotspots de la scène' })).toBeVisible();

    await page.goto(tourUrl);

    // 7. Appel de la validation du graphe
    await readPost(
      page,
      /\/api\/v1\/admin\/tours\/[a-f0-9-]+\/validate$/,
      async () => {
        await page.getByTestId('validate-tour-btn').click();
      }
    );
    
    // Attendre que la UI affiche qu'il n'y a pas d'erreur
    await expect(page.getByTestId('validation-success')).toBeVisible();

    // 8. Publication
    await readPost(
      page,
      /\/api\/v1\/admin\/tours\/[a-f0-9-]+\/publish$/,
      async () => {
        await page.getByTestId('publish-tour-btn').click();
      }
    );

    // 9. Vérification que le statut est PUBLISHED
    await expect(page.getByTestId('tour-status-published')).toBeVisible();
  });
});
