/**
 * Comptes de démonstration (NF-09), référentiels API-25 et hôtel de démonstration (D-66).
 * Les visites de démonstration restent à faire dans M1.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSeed } from '../src/seed/run-seed.js';
import { SEED_CATEGORIES, SEED_CITIES } from '../src/seed/seed-catalog.js';
import {
  SEED_HOTEL,
  SEED_KIOSK,
  SEED_MANAGER_EMAIL,
  SEED_SELECTION_ID,
} from '../src/seed/seed-hotels.js';
import { SEED_TOURS } from '../src/seed/seed-tours.js';
import { SEED_USERS } from '../src/seed/seed-users.js';

function loadLocalEnvFile(): void {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
  if (!existsSync(path)) {
    return;
  }
  process.loadEnvFile(path);
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  await runSeed();
  console.log(`${String(SEED_USERS.length)} utilisateurs de démonstration prêts.`);
  console.log(
    `${String(SEED_CITIES.length)} villes et ${String(SEED_CATEGORIES.length)} catégories de démonstration prêtes.`,
  );
  console.log(
    `${String([SEED_HOTEL].length)} hôtel, ${String([SEED_SELECTION_ID].length)} sélection, ${String([SEED_KIOSK].length)} kiosque et ${String([SEED_MANAGER_EMAIL].length)} rattachement de démonstration prêts.`,
  );
  console.log(`${String(SEED_TOURS.length)} visites liées prêtes.`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Échec du seed';
  console.error(message);
  process.exitCode = 1;
});
