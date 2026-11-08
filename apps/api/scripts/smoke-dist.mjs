/* global console, process */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptsDir, '../../..');

  if (!existsSync(path.join(repoRoot, 'package.json'))) {
    console.error(`[smoke:dist] Impossible de localiser la racine du dépôt depuis ${scriptsDir}`);
    process.exit(1);
  }

  console.log('[smoke:dist] 1/2 Compilation de @xplor/api...');
  const buildResult = spawnSync('pnpm', ['--filter', '@xplor/api', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (buildResult.error) {
    console.error('[smoke:dist] Échec du lancement de la compilation :', buildResult.error);
    process.exit(1);
  }

  if (buildResult.status !== 0) {
    console.error(`[smoke:dist] La compilation a échoué avec le code ${String(buildResult.status)}`);
    process.exit(buildResult.status ?? 1);
  }

  console.log('[smoke:dist] 2/2 Vérification des imports dist...');
  const importCode =
    "await import('./apps/api/dist/auth/two-factor.service.js'); " +
    "await import('./apps/api/dist/auth/auth.service.js'); " +
    "await import('./apps/api/dist/app.module.js');";

  const checkResult = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', importCode],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  if (checkResult.error) {
    console.error('[smoke:dist] Échec de la vérification des imports :', checkResult.error);
    process.exit(1);
  }

  if (checkResult.status !== 0) {
    console.error(
      `[smoke:dist] Le chargement des modules a échoué avec le code ${String(checkResult.status)}`,
    );
    process.exit(checkResult.status ?? 1);
  }

  console.log('[smoke:dist] Test de fumée du build dist réussi.');
} catch (error) {
  console.error('[smoke:dist] Exception non gérée :', error);
  process.exit(1);
}
