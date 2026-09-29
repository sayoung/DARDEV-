import { PrismaClient } from '@prisma/client';
import { afterAll, expect, it } from 'vitest';

import { readDatabaseUrlTest } from './global-setup.js';

const prisma = new PrismaClient({
  datasourceUrl: readDatabaseUrlTest(),
  errorFormat: 'minimal',
});

afterAll(async () => {
  await prisma.$disconnect();
});

it('migrate deploy crée les tables User et UserToken et les enums Role et UserTokenType', async () => {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;
  const tableNames = tables.map((row) => row.table_name);

  expect(tableNames).toEqual(expect.arrayContaining(['User', 'UserToken']));

  const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
    SELECT typname
    FROM pg_type
    WHERE typtype = 'e'
      AND typnamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = 'public'
      )
  `;
  const enumNames = enums.map((row) => row.typname);

  expect(enumNames).toEqual(expect.arrayContaining(['Role', 'UserTokenType']));
});
