import { expect, type Page } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
const sharp = require('sharp');

/**
 * Assure qu'un certain nombre de panoramas prêts sont présents dans la médiathèque.
 * @param page La page Playwright (doit être déjà connectée en admin)
 * @param count Le nombre de panoramas prêts souhaités
 */
export async function ensureReadyPanoramas(page: Page, count: number): Promise<void> {
  // 1. Navigation vers /media
  await page.goto('/media');
  await expect(page.getByRole('heading', { name: 'Médiathèque' })).toBeVisible();

  // Attendre le chargement de la liste (soit un tableau, soit le message vide)
  await expect(
    page.getByRole('table').or(page.getByText('Aucun média', { exact: false }))
  ).toBeVisible({ timeout: 10000 });

  // 2. Compter le nombre de panoramas déjà "Prêt"
  const currentReady = await page.getByTestId('processing-status-ready').count();

  if (currentReady >= count) {
    return;
  }

  const needed = count - currentReady;

  // 3. Génération d'un JPEG 4096x2048 en mémoire
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  const buffer = await sharp({
    create: {
      width: 4096,
      height: 2048,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

  // 4. Téléversement des images manquantes
  for (let i = 0; i < needed; i++) {
    const finalBuffer = Buffer.from(buffer);
    
    await page.locator('input[type="file"]').setInputFiles({
      name: `test-pano-${String(Date.now())}-${String(i)}.jpg`,
      mimeType: 'image/jpeg',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      buffer: finalBuffer,
    });
    
    const envoyerBtn = page.getByRole('button', { name: 'Envoyer' });
    await envoyerBtn.click();
    
    // Attendre que le bouton redevienne actif (désactivé pendant l'upload)
    await expect(envoyerBtn).toBeEnabled({ timeout: 15000 });
  }

  // 5. Attendre que le nombre total de panoramas prêts soit atteint
  await expect
    .poll(
      async () => {
        return await page.getByTestId('processing-status-ready').count();
      },
      {
        message: `En attente de ${String(count)} panoramas prêts`,
        timeout: 90000,
      }
    )
    .toBeGreaterThanOrEqual(count);
}
