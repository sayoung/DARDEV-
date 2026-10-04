import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';

interface PrismaClientInstance {
  tour: {
    updateMany: (args: { where: { shareToken: string }, data: { publicShare: boolean } }) => Promise<unknown>;
  };
  $disconnect: () => Promise<void>;
}

interface PrismaModule {
  PrismaClient: new (args: { datasources: { db: { url: string } } }) => PrismaClientInstance;
}

function isPrismaModule(obj: unknown): obj is PrismaModule {
  return typeof obj === 'object' && obj !== null && 'PrismaClient' in obj;
}

export async function enablePublicShare(shareToken: string) {
  const rootDir = process.cwd();
  const apiEnvPath = path.join(rootDir, 'apps/api/.env');
  
  let dbUrl = process.env.DATABASE_URL;

  if (fs.existsSync(apiEnvPath)) {
    const envContent = fs.readFileSync(apiEnvPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = /^\s*DATABASE_URL\s*=\s*(.*)/.exec(line);
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
  
  const prismaModule: unknown = requireApi('@prisma/client');
  if (!isPrismaModule(prismaModule)) {
    throw new Error('Could not load PrismaClient from @prisma/client');
  }

  const prisma = new prismaModule.PrismaClient({
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
