import { PrismaClient, Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';

import { PasswordService } from '../auth/password.service.js';
import { seedCatalog, SEED_CATEGORIES, SEED_CITIES } from './seed-catalog.js';
import {
  seedHotels,
  SEED_HOTEL,
  SEED_KIOSK,
  SEED_MANAGER_EMAIL,
  SEED_SELECTION_ID,
} from './seed-hotels.js';
import { seedTours, SEED_TOURS } from './seed-tours.js';
import { buildSeedUsers, type SeedUser } from './seed-users.js';

const PRISMA_ROLE: Record<Role, PrismaRole> = {
  [Role.ADMIN]: PrismaRole.ADMIN,
  [Role.EDITOR]: PrismaRole.EDITOR,
  [Role.HOTEL_MANAGER]: PrismaRole.HOTEL_MANAGER,
  [Role.PARTNER]: PrismaRole.PARTNER,
};

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

export async function runSeed(): Promise<void> {
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
  console.log(
    `${String([SEED_HOTEL].length)} hôtel, ${String([SEED_SELECTION_ID].length)} sélection, ${String([SEED_KIOSK].length)} kiosque et ${String([SEED_MANAGER_EMAIL].length)} rattachement de démonstration prêts.`,
  );
  console.log(`${String(SEED_TOURS.length)} visites liées prêtes.`);
}
