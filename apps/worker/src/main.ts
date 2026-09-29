import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from './env.js';

function loadLocalEnvFile(): void {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
  if (!existsSync(path)) {
    return;
  }
  process.loadEnvFile(path);
}

export function boot(
  source: Record<string, string | undefined>,
  log: (message: string) => void,
): void {
  loadEnv(source);
  log('worker prêt');
}

if (process.env.VITEST !== 'true') {
  loadLocalEnvFile();
  try {
    boot(process.env, (message) => {
      console.log(message);
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown startup error';
    console.error(message);
    process.exit(1);
  }
}
