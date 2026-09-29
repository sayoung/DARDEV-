import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { PrismaClient } from '@prisma/client';
import { LocalizedTextSchema, Role } from '@xplor/shared';
import { afterAll, expect, it } from 'vitest';

import { PasswordService } from '../src/auth/password.service.js';
import { SEED_CATEGORIES, SEED_CITIES } from '../src/seed/seed-catalog.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const prisma = new PrismaClient({
  datasourceUrl: readDatabaseUrlTest(),
  errorFormat: 'minimal',
});

afterAll(async () => {
  await prisma.$disconnect();
});

it('deux exécutions du seed laissent quatre utilisateurs actifs, un par rôle', async () => {
  const password = readSeedPassword();
  await resetDb();
  await runSeed(password);
  await runSeed(password);

  const users = await prisma.user.findMany();
  const roles = users.map((user) => user.role).sort();

  expect(users).toHaveLength(4);
  expect(users.every((user) => user.active)).toBe(true);
  expect(roles).toEqual([Role.ADMIN, Role.EDITOR, Role.HOTEL_MANAGER, Role.PARTNER].sort());

  const passwords = new PasswordService();
  for (const user of users) {
    expect(await passwords.verify(user.passwordHash, password)).toBe(true);
  }

  const cities = await prisma.city.findMany();
  const categories = await prisma.category.findMany();
  expect(cities.map((city) => city.id).sort()).toEqual(SEED_CITIES.map((city) => city.id).sort());
  expect(categories.map((category) => category.id).sort()).toEqual(
    SEED_CATEGORIES.map((category) => category.id).sort(),
  );
  for (const city of cities) {
    const expected = SEED_CITIES.find((item) => item.id === city.id);
    if (expected === undefined) {
      throw new Error(`ville absente du référentiel de seed : ${city.id}`);
    }
    expect(LocalizedTextSchema.parse(city.name)).toEqual(expected.name);
  }
  for (const category of categories) {
    const expected = SEED_CATEGORIES.find((item) => item.id === category.id);
    if (expected === undefined) {
      throw new Error(`catégorie absente du référentiel de seed : ${category.id}`);
    }
    expect(LocalizedTextSchema.parse(category.name)).toEqual(expected.name);
    expect(category.icon).toBe(expected.icon);
    expect(category.color).toBe(expected.color);
    expect(category.weight).toBe(expected.weight);
  }
});

function readSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password.trim() === '') {
    throw new Error(MISSING_SEED_PASSWORD);
  }
  return password;
}

async function runSeed(password: string): Promise<void> {
  const tsxPackageJson = nodeRequire.resolve('tsx/package.json');
  const tsxCli = resolve(dirname(tsxPackageJson), 'dist/cli.mjs');
  try {
    await execFileAsync(process.execPath, [tsxCli, 'prisma/seed.ts'], {
      cwd: apiRoot,
      env: childEnv({
        DATABASE_URL: readDatabaseUrlTest(),
        SEED_DEFAULT_PASSWORD: password,
      }),
      encoding: 'utf8',
    });
  } catch (error: unknown) {
    throw new Error(`Le seed a échoué.\n${commandFailure(error)}`);
  }
}

function childEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return { ...env, ...overrides };
}

function commandFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Échec inconnu';
  }
  const stderr = readOutput(error, 'stderr');
  const stdout = readOutput(error, 'stdout');
  return [error.message, stderr, stdout].filter((part) => part.length > 0).join('\n');
}

function readOutput(error: Error, key: 'stderr' | 'stdout'): string {
  const value: unknown = Object.getOwnPropertyDescriptor(error, key)?.value;
  return typeof value === 'string' ? value.trim() : '';
}
