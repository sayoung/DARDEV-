/**
 * Comptes de démonstration (NF-09), référentiels API-25 et hôtel de démonstration (D-66).
 * Les visites de démonstration restent à faire dans M1.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient, Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';

import { PasswordService } from '../src/auth/password.service.js';
import { seedCatalog, SEED_CATEGORIES, SEED_CITIES } from '../src/seed/seed-catalog.js';
import { seedHotels } from '../src/seed/seed-hotels.js';
import { seedTours } from '../src/seed/seed-tours.js';
import { buildSeedUsers, type SeedUser } from '../src/seed/seed-users.js';

const PRISMA_ROLE: Record<Role, PrismaRole> = {
  [Role.ADMIN]: PrismaRole.ADMIN,
  [Role.EDITOR]: PrismaRole.EDITOR,
  [Role.HOTEL_MANAGER]: PrismaRole.HOTEL_MANAGER,
  [Role.PARTNER]: PrismaRole.PARTNER,
};

function loadLocalEnvFile(): void {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
  if (!existsSync(path)) {
    return;
  }
  process.loadEnvFile(path);
}

function readSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password === '') {
    throw new Error(
      'SEED_DEFAULT_PASSWORD est absent. Ajoutez-le au fichier .env (voir .env.example).',
    );
  }
  return password;
}

async function upsertSeedUser(prisma: PrismaClient, user: SeedUser): Promise<void> {
  const data = {
    name: user.name,
    passwordHash: user.passwordHash,
    role: PRISMA_ROLE[user.role],
    active: user.active,
    uiLang: user.uiLang,
  };
  await prisma.user.upsert({
    where: { email: user.email },
    create: { email: user.email, ...data },
    update: data,
  });
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  const password = readSeedPassword();
  const hash = await new PasswordService().hash(password);
  const users = buildSeedUsers(password, hash);
  const prisma = new PrismaClient();
  try {
    for (const user of users) {
      await upsertSeedUser(prisma, user);
    }
    await seedCatalog(prisma);
    await seedHotels(prisma);
    await seedTours(prisma);
  } finally {
    await prisma.$disconnect();
  }
  console.log(`${String(users.length)} utilisateurs de démonstration prêts.`);
  console.log(
    `${String(SEED_CITIES.length)} villes et ${String(SEED_CATEGORIES.length)} catégories de démonstration prêtes.`,
  );
  console.log('1 hôtel, 1 sélection, 1 kiosque et 1 rattachement de démonstration prêts.');
  console.log('3 visites liées prêtes.');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Échec du seed';
  console.error(message);
  process.exitCode = 1;
});
