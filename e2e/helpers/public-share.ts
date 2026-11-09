import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';
import type { Page } from '@playwright/test';
import {
  HotspotIcon,
  HotspotType,
  TourGraphSchema,
  type TourGraph,
} from '@xplor/shared';

const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function createSimulatedTourGraph(): TourGraph {
  const scene1Id = '01990000-0000-7000-8000-000000000001';
  const scene2Id = '01990000-0000-7000-8000-000000000002';
  const hotspot1Id = '01990000-0000-7000-8000-000000000003';
  const hotspot2Id = '01990000-0000-7000-8000-000000000004';

  return TourGraphSchema.parse({
    id: '01990000-0000-7000-8000-000000000000',
    contentVersion: 1,
    lang: 'fr',
    title: 'Kasbah des Oudayas',
    summary: 'Visite publique simulée pour les tests d’accessibilité.',
    city: 'Rabat',
    categories: ['Monuments'],
    coverUrl: 'https://media.test/cover.jpg',
    practicalInfo: 'Informations pratiques sur la visite.',
    location: { lat: 34.0314, lng: -6.8363 },
    startSceneId: scene1Id,
    scenes: [
      {
        id: scene1Id,
        title: 'Porte Bab Oudaya',
        caption: 'Entrée principale de la kasbah',
        thumb: 'https://media.test/scene1-thumb.jpg',
        narrationUrl: null,
        ambientUrl: null,
        panorama: {
          preview: 'https://media.test/scene1-preview.jpg',
          web: 'https://media.test/scene1-web.jpg',
          tiles: {
            width: 2048,
            cols: 2,
            rows: 1,
            baseUrl: 'https://media.test/scene1-tiles/{col}_{row}.jpg',
          },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 50 },
        hotspots: [
          {
            id: hotspot1Id,
            type: HotspotType.SCENE_LINK,
            yaw: 1.0,
            pitch: 0.0,
            label: 'Entrer dans la kasbah',
            icon: HotspotIcon.ARROW,
            targetSceneId: scene2Id,
            arrivalYaw: 0,
          },
          {
            id: hotspot2Id,
            type: HotspotType.INFO,
            yaw: -1.0,
            pitch: 0.2,
            label: 'Histoire de la porte',
            icon: HotspotIcon.INFO,
            bodyHtml: '<p>Une porte monumentale édifiée au XIIe siècle.</p>',
            images: [],
          },
        ],
      },
      {
        id: scene2Id,
        title: 'Jardin andalou',
        caption: 'Cour intérieure et jardins',
        thumb: 'https://media.test/scene2-thumb.jpg',
        narrationUrl: null,
        ambientUrl: null,
        panorama: {
          preview: 'https://media.test/scene2-preview.jpg',
          web: 'https://media.test/scene2-web.jpg',
          tiles: {
            width: 2048,
            cols: 2,
            rows: 1,
            baseUrl: 'https://media.test/scene2-tiles/{col}_{row}.jpg',
          },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 50 },
        hotspots: [],
      },
    ],
    linkedTours: [],
  });
}

export interface PublicTourDoubleOptions {
  token?: string;
  graph?: TourGraph;
}

export async function installPublicTourDouble(
  page: Page,
  options?: PublicTourDoubleOptions,
): Promise<{ token: string; graph: TourGraph }> {
  const token = options?.token ?? 'visite-simulee';
  const graph = options?.graph ?? createSimulatedTourGraph();

  await page.route(
    (url) => url.pathname.includes(`/api/v1/public/tours/${token}`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graph),
      });
    },
  );

  const imageBuffer = Buffer.from(TRANSPARENT_PNG_BASE64, 'base64');
  await page.route(
    (url) => url.hostname === 'media.test' || url.pathname.includes('media.test'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: imageBuffer,
      });
    },
  );

  await page.route(
    (url) => url.pathname.startsWith('/api/v1/events') || url.pathname.startsWith('/api/v1/stats'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    },
  );

  return { token, graph };
}

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
