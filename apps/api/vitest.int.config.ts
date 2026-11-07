import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Projet Vitest `api-int` (NF-08). Lancé par `pnpm test:int`.
 * Il n'est pas dans `vitest.workspace.ts` : `pnpm test` ne le charge pas.
 */
export default defineConfig({
  cacheDir: path.join(os.tmpdir(), 'xplor-vitest-int-cache'),
  test: {
    name: 'api-int',
    environment: 'node',
    include: ['**/*.int.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
