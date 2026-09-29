/**
 * Préparation de la base `DATABASE_URL_TEST` pour le projet Vitest `api-int`.
 * `setup` est le globalSetup : message clair si la variable manque ou si
 * PostgreSQL est injoignable, puis `prisma migrate deploy`.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { Prisma, PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// `apps/api` est deux niveaux sous la racine du dépôt (même `.env` que `prisma/seed.ts`).
const repoEnvPath = resolve(apiRoot, '../../.env');

export const MISSING_DATABASE_URL_TEST =
  "DATABASE_URL_TEST est absent. Les tests d'intégration API (pnpm test:int) ont besoin de cette variable : copiez .env.example vers .env ou exportez-la (voir docs/INSTALL.md).";

loadRepoEnv();

export async function setup(): Promise<void> {
  try {
    const databaseUrl = readDatabaseUrlTest();
    await assertDatabaseReachable(databaseUrl);
    await migrateDeploy(databaseUrl);
  } catch (error: unknown) {
    stop(errorText(error));
  }
}

function stop(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/** Vide toutes les tables applicatives. `_prisma_migrations` est conservée. */
export async function resetDb(): Promise<void> {
  const prisma = createClient(readDatabaseUrlTest());
  try {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
    `;
    const identifiers = rows.map((row) => Prisma.raw(quoteIdentifier(row.tablename)));
    if (identifiers.length === 0) {
      return;
    }
    await prisma.$executeRaw(Prisma.sql`TRUNCATE TABLE ${Prisma.join(identifiers)} CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}

export function readDatabaseUrlTest(): string {
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    throw new Error(MISSING_DATABASE_URL_TEST);
  }
  return databaseUrl;
}

function loadRepoEnv(): void {
  if (!existsSync(repoEnvPath)) {
    return;
  }
  process.loadEnvFile(repoEnvPath);
}

function createClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
    errorFormat: 'minimal',
  });
}

async function assertDatabaseReachable(databaseUrl: string): Promise<void> {
  let prisma: PrismaClient | undefined;
  try {
    prisma = createClient(databaseUrl);
    await prisma.$queryRaw`SELECT 1`;
  } catch (error: unknown) {
    throw new Error(unreachableMessage(errorText(error)));
  } finally {
    await prisma?.$disconnect().catch(() => undefined);
  }
}

function unreachableMessage(detail: string): string {
  return `Impossible de joindre la base indiquée par DATABASE_URL_TEST. Démarrez PostgreSQL avec Docker (docker compose up -d), vérifiez que la base xplor_test existe, puis relancez pnpm test:int. ${detail}`;
}

async function migrateDeploy(databaseUrl: string): Promise<void> {
  const prismaCli = nodeRequire.resolve('prisma/build/index.js');
  try {
    await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: apiRoot,
      env: childEnv({ DATABASE_URL: databaseUrl }),
      encoding: 'utf8',
    });
  } catch (error: unknown) {
    throw new Error(
      `prisma migrate deploy a échoué sur DATABASE_URL_TEST.\n${commandFailure(error)}`,
    );
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

function quoteIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Nom de table inattendu pour TRUNCATE : ${name}`);
  }
  return `"${name}"`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur inconnue';
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
