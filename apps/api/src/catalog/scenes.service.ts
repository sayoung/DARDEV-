import { Inject, Injectable, type HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SceneResponseSchema,
  type SceneCreate,
  type SceneResponse,
  type SceneUpdate,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  PANORAMA_ASSET_NOT_FOUND,
  PANORAMA_ASSET_NOT_FOUND_MESSAGE,
  SCENE_NOT_FOUND,
  SCENE_NOT_FOUND_MESSAGE,
  TOUR_NOT_FOUND,
  TOUR_NOT_FOUND_MESSAGE,
  isForeignKeyViolation,
  isRecordMissing,
  missingException,
  referenceException,
} from './catalog.errors.js';
import { localizedToJson } from './localized-json.js';

const sceneInclude = {
  tour: {
    select: { deletedAt: true },
  },
  _count: {
    select: { hotspots: true },
  },
} satisfies Prisma.SceneInclude;

type SceneRow = Prisma.SceneGetPayload<{ include: typeof sceneInclude }>;

interface ActiveTour {
  id: string;
  startSceneId: string | null;
}

@Injectable()
export class ScenesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tourId: string): Promise<SceneResponse[]> {
    await this.loadActiveTour(tourId);
    const rows = await this.prisma.scene.findMany({
      where: { tourId, deletedAt: null },
      include: sceneInclude,
      orderBy: [{ weight: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => toScene(row));
  }

  async get(id: string): Promise<SceneResponse> {
    return toScene(await this.loadActive(id));
  }

  async create(tourId: string, input: SceneCreate, createdById: string): Promise<SceneResponse> {
    await this.loadActiveTour(tourId);
    await this.assertPanorama(input.panoramaAssetId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tour = await this.loadActiveTour(tourId, tx);
        const created = await tx.scene.create({
          data: {
            tourId: tour.id,
            createdById,
            ...sceneScalars(input),
          },
        });
        await tx.tour.update({
          where: { id: tour.id },
          data: {
            ...(tour.startSceneId === null ? { startSceneId: created.id } : {}),
            contentVersion: { increment: 1 },
          },
        });
        return toScene(await this.loadActive(created.id, tx));
      });
    } catch (error: unknown) {
      return await rethrowReferenceOrMissing(
        error,
        TOUR_NOT_FOUND,
        TOUR_NOT_FOUND_MESSAGE,
        async () => {
          await this.loadActiveTour(tourId);
          await this.assertPanorama(input.panoramaAssetId);
        },
      );
    }
  }

  async update(id: string, input: SceneUpdate): Promise<SceneResponse> {
    const current = await this.loadActive(id);
    await this.assertPanorama(input.panoramaAssetId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.loadActive(id, tx);
        await tx.scene.update({
          where: { id },
          data: sceneScalars(input),
        });
        await tx.tour.update({
          where: { id: current.tourId },
          data: { contentVersion: { increment: 1 } },
        });
        return toScene(await this.loadActive(id, tx));
      });
    } catch (error: unknown) {
      return await rethrowReferenceOrMissing(
        error,
        SCENE_NOT_FOUND,
        SCENE_NOT_FOUND_MESSAGE,
        async () => {
          await this.loadActive(id);
          await this.assertPanorama(input.panoramaAssetId);
        },
      );
    }
  }

  /** Suppression logique. Si c'était la scène de départ, `startSceneId` revient à null. */
  async remove(id: string): Promise<void> {
    await this.loadActive(id);
    try {
      await this.prisma.$transaction(async (tx) => {
        const scene = await this.loadActive(id, tx);
        const tour = await this.loadActiveTour(scene.tourId, tx);
        await tx.scene.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
        await tx.tour.update({
          where: { id: tour.id },
          data: {
            ...(tour.startSceneId === id ? { startSceneId: null } : {}),
            contentVersion: { increment: 1 },
          },
        });
      });
    } catch (error: unknown) {
      await rethrowReferenceOrMissing(error, SCENE_NOT_FOUND, SCENE_NOT_FOUND_MESSAGE, async () => {
        await this.loadActive(id);
      });
    }
  }

  private async loadActiveTour(id: string, client: SceneClient = this.prisma): Promise<ActiveTour> {
    const tour = await client.tour.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, startSceneId: true },
    });
    if (tour === null) {
      throw missingException(TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE);
    }
    return tour;
  }

  private async loadActive(id: string, client: SceneClient = this.prisma): Promise<SceneRow> {
    const row = await client.scene.findFirst({
      where: { id, deletedAt: null },
      include: sceneInclude,
    });
    if (row === null || row.tour.deletedAt !== null) {
      throw missingException(SCENE_NOT_FOUND, SCENE_NOT_FOUND_MESSAGE);
    }
    return row;
  }

  private async assertPanorama(id: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      select: { id: true },
    });
    if (asset === null) {
      throw referenceException(PANORAMA_ASSET_NOT_FOUND, PANORAMA_ASSET_NOT_FOUND_MESSAGE);
    }
  }
}

type SceneClient = PrismaService | Prisma.TransactionClient;

function sceneScalars(input: SceneCreate): {
  title: Prisma.InputJsonValue;
  caption: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
  panoramaAssetId: string;
  initialYaw: number;
  initialPitch: number;
  initialZoom: number;
  weight: number;
} {
  return {
    title: localizedToJson(input.title),
    caption: input.caption === undefined ? Prisma.DbNull : localizedToJson(input.caption),
    panoramaAssetId: input.panoramaAssetId,
    initialYaw: input.initialYaw,
    initialPitch: input.initialPitch,
    initialZoom: input.initialZoom,
    weight: input.weight,
  };
}

function toScene(row: SceneRow): SceneResponse {
  const caption = row.caption === null ? undefined : row.caption;
  return SceneResponseSchema.parse({
    id: row.id,
    tourId: row.tourId,
    title: row.title,
    ...(caption === undefined ? {} : { caption }),
    panoramaAssetId: row.panoramaAssetId,
    initialYaw: row.initialYaw,
    initialPitch: row.initialPitch,
    initialZoom: row.initialZoom,
    weight: row.weight,
    hotspotCount: row._count.hotspots,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/**
 * Une `HttpException` (404, 422) sort telle quelle.
 * Une clé étrangère relance la vérification des références.
 * Une ligne disparue entre-temps répond 404 au format du cahier.
 * `never` : tous les chemins lèvent.
 */
async function rethrowReferenceOrMissing(
  error: unknown,
  missingCode: string,
  missingMessage: string,
  recheck: () => Promise<void>,
): Promise<never> {
  if (isHttpException(error)) {
    throw error;
  }
  if (isRecordMissing(error)) {
    throw missingException(missingCode, missingMessage);
  }
  if (isForeignKeyViolation(error)) {
    await recheck();
  }
  throw error;
}

function isHttpException(error: unknown): error is HttpException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getStatus' in error &&
    typeof error.getStatus === 'function'
  );
}
