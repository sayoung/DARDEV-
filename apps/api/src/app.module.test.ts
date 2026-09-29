import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';
import { AuthController } from './auth/auth.controller.js';
import { CategoriesController } from './catalog/categories.controller.js';
import { CitiesController } from './catalog/cities.controller.js';
import { loadEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { UsersController } from './users/users.controller.js';

/**
 * Vitest (esbuild) n'émet pas `design:paramtypes`. Le graphe Nest doit
 * quand même s'instancier : c'est ce que `pnpm test:int` fait en CI (D-57).
 */
const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://xplor:xplor@127.0.0.1:5432/xplor',
  REDIS_URL: 'redis://127.0.0.1:6379',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_ACCESS_KEY: 'xplor',
  S3_SECRET_KEY: 'xplor-dev-secret',
  S3_BUCKET: 'xplor',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SESSION_SECRET: 'dev-only-session-secret-not-for-production',
});

describe('AppModule', () => {
  it('instancie les contrôleurs Nest sans design:paramtypes', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(env)],
    }).compile();
    expect(moduleRef.get(AuthController)).toBeInstanceOf(AuthController);
    expect(moduleRef.get(UsersController)).toBeInstanceOf(UsersController);
    expect(moduleRef.get(CitiesController)).toBeInstanceOf(CitiesController);
    expect(moduleRef.get(CategoriesController)).toBeInstanceOf(CategoriesController);
    expect(moduleRef.get(HealthController)).toBeInstanceOf(HealthController);
    await moduleRef.close();
  });
});
