import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AppModule } from '../app.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { AssetsService } from '../catalog/assets.service.js';
import { parseReprocessArgs } from './reprocess-args.js';
import { formatCliError } from './format-error.js';
import { loadEnv } from '../config/env.js';
import { runSeed } from '../seed/run-seed.js';

function loadLocalEnvFile(): void {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env');
  if (!existsSync(path)) {
    return;
  }
  process.loadEnvFile(path);
}

async function bootstrap() {
  const logger = new Logger('CLI');
  const command = process.argv[2];

  if (command === 'seed') {
    loadLocalEnvFile();
    logger.log('Lancement du script de seed...');
    try {
      await runSeed();
      logger.log('Seed terminé avec succès.');
      process.exit(0);
    } catch (error) {
      logger.error(`Erreur lors du seed: ${formatCliError(error)}`);
      process.exit(1);
    }
    return;
  }

  let mode;
  try {
    mode = parseReprocessArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error("Erreur inconnue lors de l'analyse des arguments.");
    }
    process.exit(1);
  }

  loadLocalEnvFile();
  const env = loadEnv(process.env);

  logger.log('Initialisation du contexte NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const assetsService = app.select(CatalogModule).get(AssetsService);

    if (mode.mode === 'asset') {
      logger.log(`Relance du panorama ${mode.assetId}...`);
      await assetsService.reprocess(mode.assetId);
      logger.log(`Panorama ${mode.assetId} mis en file d'attente avec succès.`);
    } else {
      logger.log('Relance de tous les panoramas READY ou ERROR...');
      const count = await assetsService.reprocessAllPanoramas();
      logger.log(`${String(count)} panorama(s) mis en file d'attente avec succès.`);
    }

    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error(`Erreur: ${formatCliError(error)}`);
    await app.close();
    process.exit(1);
  }
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
