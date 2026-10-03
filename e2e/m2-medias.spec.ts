import { test, expect } from '@playwright/test';

test.describe('Livrable M2 : gestion des médias', () => {
  test('Doit rejeter un panorama trop petit (F-10)', async ({ page }) => {
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

    // 2. Navigation vers /media
    await page.getByRole('link', { name: 'Médias', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Médiathèque' })).toBeVisible();

    // 3. Upload d'un petit fichier
    // Un JPEG valide de 1x1 pixel encodé en base64
    const tinyJpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQEAYABgAAD/wAARCABkAMgDASIAAhEBAxEB/9k=',
      'base64'
    );

    await page.locator('input[type="file"]').setInputFiles({
      name: 'tiny-invalid.jpg',
      mimeType: 'image/jpeg',
      buffer: tinyJpeg
    });

    await page.getByRole('button', { name: 'Envoyer' }).click();

    // 4. Vérifier qu'un message d'erreur s'affiche concernant la largeur
    await expect(page.locator('text=/attendu : >= 4096 ; reçu : 200/i').first()).toBeVisible({ timeout: 10000 });
    
    // Le statut dans la liste du PanoramaUploader est 'Erreur'
    await expect(page.getByText('Erreur', { exact: true }).first()).toBeVisible();
  });
});
