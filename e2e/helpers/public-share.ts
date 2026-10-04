/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';

export async function enablePublicShare(shareToken: string) {
  const rootDir = process.cwd();
  const apiEnvPath = path.join(rootDir, 'apps/api/.env');
  
  let dbUrl = process.env.DATABASE_URL;

  if (fs.existsSync(apiEnvPath)) {
    const envContent = fs.readFileSync(apiEnvPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)/);
      if (match && match[1]) {
        if (!dbUrl) {
          dbUrl = match[1].trim();
        }
      }
    }
  }

  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set in environment or apps/api/.env');
  }

  const apiPackagePath = path.join(rootDir, 'apps/api/package.json');
  const requireApi = createRequire(apiPackagePath);
  
  const { PrismaClient } = requireApi('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    await prisma.tour.updateMany({
      where: { shareToken },
      data: { publicShare: true },
    });
  } finally {
    await prisma.$disconnect();
  }
}
