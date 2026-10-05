/**
 * Comptes de démonstration (NF-09), référentiels API-25 et hôtel de démonstration (D-66).
 * Les visites de démonstration restent à faire dans M1.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSeed } from '../src/seed/run-seed.js';

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
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Échec du seed';
  console.error(message);
  process.exitCode = 1;
});
