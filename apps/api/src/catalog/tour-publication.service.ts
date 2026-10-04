import { Inject, Injectable } from '@nestjs/common';
import {
  HotspotType as PrismaHotspotType,
  Prisma,
  ProcessingStatus as PrismaProcessingStatus,
  TourStatus as PrismaTourStatus,
} from '@prisma/client';
import {
  HotspotType,
  ProcessingStatus,
  TourStatus,
  TourValidationResponseSchema,
  type TourResponse,
  type TourValidationResponse,
  type ValidationIssue,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  TOUR_NOT_FOUND,
  TOUR_NOT_FOUND_MESSAGE,
  missingException,
  notPublishableException,
} from './catalog.errors.js';
import { ToursService } from './tours.service.js';
import { createShareToken } from './share-token.js';
import {
  validateTour,
  type FindTargetTour,
  type TargetTourSnapshot,
  type TourSnapshot,
} from './publication-rules.js';

const PROCESSING_STATUS = {
  [PrismaProcessingStatus.PENDING]: ProcessingStatus.PENDING,
  [PrismaProcessingStatus.PROCESSING]: ProcessingStatus.PROCESSING,
  [PrismaProcessingStatus.READY]: ProcessingStatus.READY,
  [PrismaProcessingStatus.ERROR]: ProcessingStatus.ERROR,
} as const satisfies Record<PrismaProcessingStatus, ProcessingStatus>;

const HOTSPOT_TYPE = {
  [PrismaHotspotType.SCENE_LINK]: HotspotType.SCENE_LINK,
  [PrismaHotspotType.TOUR_LINK]: HotspotType.TOUR_LINK,
  [PrismaHotspotType.INFO]: HotspotType.INFO,
  [PrismaHotspotType.MEDIA]: HotspotType.MEDIA,
  [PrismaHotspotType.URL]: HotspotType.URL,
} as const satisfies Record<PrismaHotspotType, HotspotType>;

const TOUR_STATUS = {
  [PrismaTourStatus.DRAFT]: TourStatus.DRAFT,
  [PrismaTourStatus.PUBLISHED]: TourStatus.PUBLISHED,
} as const satisfies Record<PrismaTourStatus, TourStatus>;

const sceneOrder = [{ weight: 'asc' as const }, { createdAt: 'asc' as const }];

/** Scènes vivantes et supprimées : une scène supprimée reste dans le graphe (D-68). */
const tourSnapshotSelect = {
  id: true,
  startSceneId: true,
  scenes: {
    orderBy: sceneOrder,
    select: {
      id: true,
      deletedAt: true,
      panoramaAsset: { select: { processingStatus: true } },
      hotspots: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          type: true,
          targetSceneId: true,
          targetTourId: true,
          targetTourSceneId: true,
        },
      },
    },
  },
} satisfies Prisma.TourSelect;

type TourSnapshotRow = Prisma.TourGetPayload<{ select: typeof tourSnapshotSelect }>;

/** `sceneIds` : scènes vivantes seulement (D-68). Les visites supprimées restent lisibles. */
const targetTourSelect = {
  id: true,
  status: true,
  deletedAt: true,
  scenes: {
    where: { deletedAt: null },
    orderBy: sceneOrder,
    select: { id: true },
  },
} satisfies Prisma.TourSelect;

type TargetTourRow = Prisma.TourGetPayload<{ select: typeof targetTourSelect }>;

type PublicationClient = PrismaService | Prisma.TransactionClient;

/**
 * Charge l'instantané Prisma et appelle `validateTour` (F-03).
 * La fonction pure n'est pas modifiée : elle ne lit pas la base.
 * `publish` écrit le statut, `publishedAt` et `contentVersion` dans une transaction.
 * `unpublish` repasse en brouillon et conserve `publishedAt`.
 */
@Injectable()
export class TourPublicationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ToursService) private readonly tours: ToursService,
  ) {}

  async validate(id: string): Promise<TourValidationResponse> {
    const issues = await this.issuesFor(this.prisma, id);
    return TourValidationResponseSchema.parse({ issues });
  }

  /** 422 sans écriture si la visite n'est pas publiable. Sinon 200 `TourResponse`. */
  async publish(id: string): Promise<TourResponse> {
    await this.prisma.$transaction(async (tx) => {
      const issues = await this.issuesFor(tx, id);
      if (issues.length > 0) {
        throw notPublishableException(issues);
      }
      await tx.tour.update({
        where: { id },
        data: {
          status: PrismaTourStatus.PUBLISHED,
          publishedAt: new Date(),
          contentVersion: { increment: 1 },
        },
      });
    });
    return this.tours.get(id);
  }

  /** Repasse en brouillon. `publishedAt` n'est pas modifié. */
  async unpublish(id: string): Promise<TourResponse> {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.tour.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (row === null) {
        throw missingException(TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE);
      }
      await tx.tour.update({
        where: { id },
        data: {
          status: PrismaTourStatus.DRAFT,
          contentVersion: { increment: 1 },
        },
      });
    });
    return this.tours.get(id);
  }

  async regenerateShareToken(id: string): Promise<TourResponse> {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.tour.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (row === null) {
        throw missingException(TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE);
      }
      await tx.tour.update({
        where: { id },
        data: {
          shareToken: createShareToken(),
          contentVersion: { increment: 1 },
        },
      });
    });
    return this.tours.get(id);
  }

  private async issuesFor(client: PublicationClient, id: string): Promise<ValidationIssue[]> {
    const row = await this.loadSnapshot(client, id);
    const targets = await this.loadTargets(client, targetTourIds(row));
    return validateTour(toSnapshot(row), targets);
  }

  private async loadSnapshot(client: PublicationClient, id: string): Promise<TourSnapshotRow> {
    const row = await client.tour.findFirst({
      where: { id, deletedAt: null },
      select: tourSnapshotSelect,
    });
    if (row === null) {
      throw missingException(TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE);
    }
    return row;
  }

  private async loadTargets(
    client: PublicationClient,
    ids: readonly string[],
  ): Promise<FindTargetTour> {
    if (ids.length === 0) {
      return () => undefined;
    }
    const rows = await client.tour.findMany({
      where: { id: { in: [...ids] } },
      select: targetTourSelect,
    });
    const byId = new Map<string, TargetTourSnapshot>(rows.map((row) => [row.id, toTarget(row)]));
    return (tourId) => byId.get(tourId);
  }
}

function targetTourIds(row: TourSnapshotRow): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const scene of row.scenes) {
    for (const hotspot of scene.hotspots) {
      if (hotspot.type !== PrismaHotspotType.TOUR_LINK || hotspot.targetTourId === null) {
        continue;
      }
      if (hotspot.targetTourId === row.id || seen.has(hotspot.targetTourId)) {
        continue;
      }
      seen.add(hotspot.targetTourId);
      ids.push(hotspot.targetTourId);
    }
  }
  return ids;
}

function toSnapshot(row: TourSnapshotRow): TourSnapshot {
  return {
    id: row.id,
    startSceneId: row.startSceneId,
    scenes: row.scenes.map((scene) => ({
      id: scene.id,
      deleted: scene.deletedAt !== null,
      panoramaStatus: PROCESSING_STATUS[scene.panoramaAsset.processingStatus],
      hotspots: scene.hotspots.map((hotspot) => ({
        id: hotspot.id,
        type: HOTSPOT_TYPE[hotspot.type],
        targetSceneId: hotspot.targetSceneId,
        targetTourId: hotspot.targetTourId,
        targetTourSceneId: hotspot.targetTourSceneId,
      })),
    })),
  };
}

function toTarget(row: TargetTourRow): TargetTourSnapshot {
  return {
    status: TOUR_STATUS[row.status],
    deleted: row.deletedAt !== null,
    sceneIds: row.scenes.map((scene) => scene.id),
  };
}
