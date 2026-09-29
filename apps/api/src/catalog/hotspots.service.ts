import { Inject, Injectable, type HttpException } from '@nestjs/common';
import {
  HotspotIcon as PrismaHotspotIcon,
  HotspotType as PrismaHotspotType,
  Prisma,
} from '@prisma/client';
import {
  HotspotIcon,
  HotspotResponseSchema,
  HotspotType,
  type HotspotCreate,
  type HotspotResponse,
  type HotspotUpdate,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  HOTSPOT_NOT_FOUND,
  HOTSPOT_NOT_FOUND_MESSAGE,
  MEDIA_ASSET_NOT_FOUND,
  MEDIA_ASSET_NOT_FOUND_MESSAGE,
  SCENE_LINK_FOREIGN,
  SCENE_LINK_FOREIGN_MESSAGE,
  SCENE_LINK_SELF,
  SCENE_LINK_SELF_MESSAGE,
  SCENE_LINK_TARGET_MISSING,
  SCENE_LINK_TARGET_MISSING_MESSAGE,
  SCENE_NOT_FOUND,
  SCENE_NOT_FOUND_MESSAGE,
  TOUR_LINK_SCENE_FOREIGN,
  TOUR_LINK_SCENE_FOREIGN_MESSAGE,
  TOUR_LINK_SELF,
  TOUR_LINK_SELF_MESSAGE,
  TOUR_LINK_TARGET_MISSING,
  TOUR_LINK_TARGET_MISSING_MESSAGE,
  isForeignKeyViolation,
  isRecordMissing,
  missingException,
  referenceException,
} from './catalog.errors.js';
import { localizedToJson } from './localized-json.js';

/**
 * Corps d'écriture. `HotspotUpdate` est la même union que `HotspotCreate` :
 * création et remplacement appellent `assertTargets` sans conversion.
 */
type HotspotWrite = HotspotCreate;

const PRISMA_TYPE = {
  [HotspotType.SCENE_LINK]: PrismaHotspotType.SCENE_LINK,
  [HotspotType.TOUR_LINK]: PrismaHotspotType.TOUR_LINK,
  [HotspotType.INFO]: PrismaHotspotType.INFO,
  [HotspotType.MEDIA]: PrismaHotspotType.MEDIA,
  [HotspotType.URL]: PrismaHotspotType.URL,
} satisfies Record<HotspotType, PrismaHotspotType>;

const PRISMA_ICON = {
  [HotspotIcon.ARROW]: PrismaHotspotIcon.ARROW,
  [HotspotIcon.INFO]: PrismaHotspotIcon.INFO,
  [HotspotIcon.PHOTO]: PrismaHotspotIcon.PHOTO,
  [HotspotIcon.PLAY]: PrismaHotspotIcon.PLAY,
  [HotspotIcon.PORTAL]: PrismaHotspotIcon.PORTAL,
} satisfies Record<HotspotIcon, PrismaHotspotIcon>;

interface ActiveScene {
  id: string;
  tourId: string;
}

type HotspotClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class HotspotsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Hotspots de la scène, du plus ancien au plus récent. */
  async list(sceneId: string): Promise<HotspotResponse[]> {
    await this.loadActiveScene(sceneId);
    const rows = await this.prisma.hotspot.findMany({
      where: { sceneId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toHotspot(row));
  }

  async create(
    sceneId: string,
    input: HotspotCreate,
    createdById: string,
  ): Promise<HotspotResponse> {
    const parent = await this.loadActiveScene(sceneId);
    await this.assertTargets(parent, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await this.loadActiveScene(sceneId, tx);
        await this.assertTargets(current, input, tx);
        const created = await tx.hotspot.create({
          data: hotspotScalars(current.id, input, createdById),
        });
        await tx.tour.update({
          where: { id: current.tourId },
          data: { contentVersion: { increment: 1 } },
        });
        const row = await tx.hotspot.findFirst({ where: { id: created.id } });
        if (row === null) {
          throw missingException(SCENE_NOT_FOUND, SCENE_NOT_FOUND_MESSAGE);
        }
        return toHotspot(row);
      });
    } catch (error: unknown) {
      return await rethrowReferenceOrMissing(
        error,
        SCENE_NOT_FOUND,
        SCENE_NOT_FOUND_MESSAGE,
        async () => {
          const current = await this.loadActiveScene(sceneId);
          await this.assertTargets(current, input);
        },
      );
    }
  }

  /**
   * Remplacement complet. Les champs des autres types sont remis à null ou `[]`
   * dans la même écriture. `sceneId` et `createdById` ne changent pas.
   */
  async update(id: string, input: HotspotUpdate): Promise<HotspotResponse> {
    const current = await this.loadActiveHotspot(id);
    await this.assertTargets(current.parent, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await this.loadActiveHotspot(id, tx);
        await this.assertTargets(row.parent, input, tx);
        await tx.hotspot.update({
          where: { id },
          data: hotspotReplacement(input),
        });
        await tx.tour.update({
          where: { id: row.parent.tourId },
          data: { contentVersion: { increment: 1 } },
        });
        const updated = await tx.hotspot.findFirst({ where: { id } });
        if (updated === null) {
          throw missingException(HOTSPOT_NOT_FOUND, HOTSPOT_NOT_FOUND_MESSAGE);
        }
        return toHotspot(updated);
      });
    } catch (error: unknown) {
      return await rethrowReferenceOrMissing(
        error,
        HOTSPOT_NOT_FOUND,
        HOTSPOT_NOT_FOUND_MESSAGE,
        async () => {
          const row = await this.loadActiveHotspot(id);
          await this.assertTargets(row.parent, input);
        },
      );
    }
  }

  /** Suppression physique. La visite parente gagne 1 de `contentVersion`. */
  async remove(id: string): Promise<void> {
    await this.loadActiveHotspot(id);
    try {
      await this.prisma.$transaction(async (tx) => {
        const row = await this.loadActiveHotspot(id, tx);
        await tx.hotspot.delete({ where: { id } });
        await tx.tour.update({
          where: { id: row.parent.tourId },
          data: { contentVersion: { increment: 1 } },
        });
      });
    } catch (error: unknown) {
      await rethrowReferenceOrMissing(
        error,
        HOTSPOT_NOT_FOUND,
        HOTSPOT_NOT_FOUND_MESSAGE,
        async () => {
          await this.loadActiveHotspot(id);
        },
      );
    }
  }

  /**
   * Cibles et médias d'un hotspot.
   * Création et remplacement passent le même corps (`HotspotCreate` ou `HotspotUpdate`).
   * Une visite cible en brouillon est acceptée.
   */
  private async assertTargets(
    parent: ActiveScene,
    input: HotspotWrite,
    client: HotspotClient = this.prisma,
  ): Promise<void> {
    if (input.type === HotspotType.SCENE_LINK) {
      await this.assertSceneLink(parent, input.targetSceneId, client);
      return;
    }
    if (input.type === HotspotType.TOUR_LINK) {
      await this.assertTourLink(parent, input.targetTourId, input.targetTourSceneId, client);
      return;
    }
    if (input.type === HotspotType.MEDIA) {
      await this.assertMedia(input.mediaAssetIds, client);
    }
  }

  private async assertSceneLink(
    parent: ActiveScene,
    targetSceneId: string,
    client: HotspotClient,
  ): Promise<void> {
    const target = await client.scene.findFirst({
      where: { id: targetSceneId },
      select: { id: true, tourId: true, deletedAt: true },
    });
    if (target === null || target.deletedAt !== null) {
      throw referenceException(SCENE_LINK_TARGET_MISSING, SCENE_LINK_TARGET_MISSING_MESSAGE);
    }
    if (target.id === parent.id) {
      throw referenceException(SCENE_LINK_SELF, SCENE_LINK_SELF_MESSAGE);
    }
    if (target.tourId !== parent.tourId) {
      throw referenceException(SCENE_LINK_FOREIGN, SCENE_LINK_FOREIGN_MESSAGE);
    }
  }

  private async assertTourLink(
    parent: ActiveScene,
    targetTourId: string,
    targetTourSceneId: string | undefined,
    client: HotspotClient,
  ): Promise<void> {
    const tour = await client.tour.findFirst({
      where: { id: targetTourId, deletedAt: null },
      select: { id: true },
    });
    if (tour === null) {
      throw referenceException(TOUR_LINK_TARGET_MISSING, TOUR_LINK_TARGET_MISSING_MESSAGE);
    }
    if (tour.id === parent.tourId) {
      throw referenceException(TOUR_LINK_SELF, TOUR_LINK_SELF_MESSAGE);
    }
    if (targetTourSceneId === undefined) {
      return;
    }
    const scene = await client.scene.findFirst({
      where: { id: targetTourSceneId, tourId: tour.id, deletedAt: null },
      select: { id: true },
    });
    if (scene === null) {
      throw referenceException(TOUR_LINK_SCENE_FOREIGN, TOUR_LINK_SCENE_FOREIGN_MESSAGE);
    }
  }

  private async assertMedia(ids: readonly string[], client: HotspotClient): Promise<void> {
    const unique = [...new Set(ids)];
    const found = await client.asset.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw referenceException(MEDIA_ASSET_NOT_FOUND, MEDIA_ASSET_NOT_FOUND_MESSAGE);
    }
  }

  private async loadActiveScene(
    id: string,
    client: HotspotClient = this.prisma,
  ): Promise<ActiveScene> {
    const row = await client.scene.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        tourId: true,
        tour: { select: { deletedAt: true } },
      },
    });
    if (row === null || row.tour.deletedAt !== null) {
      throw missingException(SCENE_NOT_FOUND, SCENE_NOT_FOUND_MESSAGE);
    }
    return { id: row.id, tourId: row.tourId };
  }

  /**
   * Hotspot dont la scène parente est encore active.
   * Une scène ou une visite parente supprimée répond le même 404 que l'absence.
   */
  private async loadActiveHotspot(
    id: string,
    client: HotspotClient = this.prisma,
  ): Promise<{ id: string; parent: ActiveScene }> {
    const row = await client.hotspot.findFirst({
      where: { id },
      select: { id: true, sceneId: true },
    });
    if (row === null) {
      throw missingException(HOTSPOT_NOT_FOUND, HOTSPOT_NOT_FOUND_MESSAGE);
    }
    try {
      const parent = await this.loadActiveScene(row.sceneId, client);
      return { id: row.id, parent };
    } catch (error: unknown) {
      if (isHttpException(error) && error.getStatus() === 404) {
        throw missingException(HOTSPOT_NOT_FOUND, HOTSPOT_NOT_FOUND_MESSAGE);
      }
      throw error;
    }
  }
}

function hotspotScalars(
  sceneId: string,
  input: HotspotWrite,
  createdById: string,
): Prisma.HotspotUncheckedCreateInput {
  return {
    sceneId,
    createdById,
    ...hotspotReplacement(input),
  };
}

/** Champs remplacés. Les autres variantes sont effacées dans la même écriture. */
function hotspotReplacement(input: HotspotWrite): {
  type: PrismaHotspotType;
  yaw: number;
  pitch: number;
  label: Prisma.InputJsonValue;
  icon: PrismaHotspotIcon;
  arrivalYaw: number | null;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
  body: Prisma.InputJsonValue | typeof Prisma.DbNull;
  mediaAssetIds: string[];
  url: string | null;
} {
  return {
    type: PRISMA_TYPE[input.type],
    yaw: input.yaw,
    pitch: input.pitch,
    label: localizedToJson(input.label),
    icon: PRISMA_ICON[input.icon],
    arrivalYaw: input.arrivalYaw ?? null,
    ...variantFields(input),
  };
}

function variantFields(input: HotspotWrite): {
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
  body: Prisma.InputJsonValue | typeof Prisma.DbNull;
  mediaAssetIds: string[];
  url: string | null;
} {
  if (input.type === HotspotType.SCENE_LINK) {
    return {
      targetSceneId: input.targetSceneId,
      targetTourId: null,
      targetTourSceneId: null,
      body: Prisma.DbNull,
      mediaAssetIds: [],
      url: null,
    };
  }
  if (input.type === HotspotType.TOUR_LINK) {
    return {
      targetSceneId: null,
      targetTourId: input.targetTourId,
      targetTourSceneId: input.targetTourSceneId ?? null,
      body: Prisma.DbNull,
      mediaAssetIds: [],
      url: null,
    };
  }
  if (input.type === HotspotType.INFO) {
    return {
      targetSceneId: null,
      targetTourId: null,
      targetTourSceneId: null,
      body: localizedToJson(input.body),
      mediaAssetIds: [],
      url: null,
    };
  }
  if (input.type === HotspotType.MEDIA) {
    return {
      targetSceneId: null,
      targetTourId: null,
      targetTourSceneId: null,
      body: Prisma.DbNull,
      mediaAssetIds: [...input.mediaAssetIds],
      url: null,
    };
  }
  return {
    targetSceneId: null,
    targetTourId: null,
    targetTourSceneId: null,
    body: Prisma.DbNull,
    mediaAssetIds: [],
    url: input.url,
  };
}

function toHotspot(row: {
  id: string;
  sceneId: string;
  type: string;
  yaw: number;
  pitch: number;
  label: Prisma.JsonValue;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
  body: Prisma.JsonValue;
  url: string | null;
  arrivalYaw: number | null;
  mediaAssetIds: string[];
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}): HotspotResponse {
  return HotspotResponseSchema.parse({
    id: row.id,
    sceneId: row.sceneId,
    type: row.type,
    yaw: row.yaw,
    pitch: row.pitch,
    label: row.label,
    targetSceneId: row.targetSceneId,
    targetTourId: row.targetTourId,
    targetTourSceneId: row.targetTourSceneId,
    body: row.body,
    url: row.url,
    arrivalYaw: row.arrivalYaw,
    mediaAssetIds: row.mediaAssetIds,
    icon: row.icon,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/**
 * Une `HttpException` (404, 422) sort telle quelle.
 * Une clé étrangère relance la vérification des cibles.
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
