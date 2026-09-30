import { Inject, Injectable, type HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SceneResponseSchema,
  type SceneCreate,
  type SceneResponse,
  type SceneUpdate,
  type TourResponse,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  PANORAMA_ASSET_NOT_FOUND,
  PANORAMA_ASSET_NOT_FOUND_MESSAGE,
  SCENE_NOT_FOUND,
  SCENE_NOT_FOUND_MESSAGE,
  SCENE_SET_MISMATCH,
  SCENE_SET_MISMATCH_MESSAGE,
  START_SCENE_FOREIGN,
  START_SCENE_FOREIGN_MESSAGE,
  TOUR_NOT_FOUND,
  TOUR_NOT_FOUND_MESSAGE,
  isForeignKeyViolation,
  isRecordMissing,
  missingException,
  referenceException,
} from './catalog.errors.js';
import { localizedToJson } from './localized-json.js';
import { ToursService } from './tours.service.js';

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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ToursService) private readonly tours: ToursService,
  ) {}

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

  /**
   * `weight` devient l'index dans `sceneIds`.
   * La liste doit être exactement les scènes non supprimées, sans doublon.
   */
  async reorder(tourId: string, sceneIds: readonly string[]): Promise<SceneResponse[]> {
    await this.loadActiveTour(tourId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tour = await this.loadActiveTour(tourId, tx);
        await this.assertExactSet(tour.id, sceneIds, tx);
        for (const [index, sceneId] of sceneIds.entries()) {
          await tx.scene.update({
            where: { id: sceneId },
            data: { weight: index },
          });
        }
        await tx.tour.update({
          where: { id: tour.id },
          data: { contentVersion: { increment: 1 } },
        });
        const rows = await tx.scene.findMany({
          where: { tourId: tour.id, deletedAt: null },
          include: sceneInclude,
          orderBy: [{ weight: 'asc' }, { createdAt: 'asc' }],
        });
        return rows.map((row) => toScene(row));
      });
    } catch (error: unknown) {
      if (isHttpException(error)) {
        throw error;
      }
      if (isRecordMissing(error) || isForeignKeyViolation(error)) {
        await this.loadActiveTour(tourId);
        await this.assertExactSet(tourId, sceneIds);
      }
      throw error;
    }
  }

  /** Pose `startSceneId`. Une scène hors de la visite, ou supprimée, répond 422. */
  async setStart(tourId: string, sceneId: string): Promise<TourResponse> {
    await this.loadActiveTour(tourId);
    await this.assertBelongs(tourId, sceneId);
    try {
      await this.prisma.$transaction(async (tx) => {
        const tour = await this.loadActiveTour(tourId, tx);
        await this.assertBelongs(tour.id, sceneId, tx);
        await tx.tour.update({
          where: { id: tour.id },
          data: {
            startSceneId: sceneId,
            contentVersion: { increment: 1 },
          },
        });
      });
    } catch (error: unknown) {
      await rethrowReferenceOrMissing(error, TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE, async () => {
        await this.loadActiveTour(tourId);
        await this.assertBelongs(tourId, sceneId);
      });
    }
    return this.tours.get(tourId);
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

  private async assertExactSet(
    tourId: string,
    sceneIds: readonly string[],
    client: SceneClient = this.prisma,
  ): Promise<void> {
    const rows = await client.scene.findMany({
      where: { tourId, deletedAt: null },
      select: { id: true },
    });
    if (!exactSceneIds(rows.map((row) => row.id), sceneIds)) {
      throw referenceException(SCENE_SET_MISMATCH, SCENE_SET_MISMATCH_MESSAGE);
    }
  }

  private async assertBelongs(
    tourId: string,
    sceneId: string,
    client: SceneClient = this.prisma,
  ): Promise<void> {
    const scene = await client.scene.findFirst({
      where: { id: sceneId, tourId, deletedAt: null },
      select: { id: true },
    });
    if (scene === null) {
      throw referenceException(START_SCENE_FOREIGN, START_SCENE_FOREIGN_MESSAGE);
    }
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
  narration?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
  ambientAssetId?: string | null;
} {
  return {
    title: localizedToJson(input.title),
    caption: input.caption === undefined ? Prisma.DbNull : localizedToJson(input.caption),
    panoramaAssetId: input.panoramaAssetId,
    initialYaw: input.initialYaw,
    initialPitch: input.initialPitch,
    initialZoom: input.initialZoom,
    weight: input.weight,
    narration: input.narration === undefined ? Prisma.DbNull : (input.narration as unknown as Prisma.InputJsonValue),
    ambientAssetId: input.ambientAssetId,
  };
}

function exactSceneIds(activeIds: readonly string[], requested: readonly string[]): boolean {
  if (requested.length !== activeIds.length) {
    return false;
  }
  const requestedSet = new Set(requested);
  if (requestedSet.size !== requested.length) {
    return false;
  }
  const active = new Set(activeIds);
  for (const id of requested) {
    if (!active.has(id)) {
      return false;
    }
  }
  return true;
}

function toScene(row: SceneRow): SceneResponse {
  const caption = row.caption === null ? undefined : row.caption;
  const narration = row.narration === null ? undefined : row.narration;
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
    ...(narration === undefined ? {} : { narration }),
    ambientAssetId: row.ambientAssetId,
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
