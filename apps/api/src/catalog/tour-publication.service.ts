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
  type TourValidationResponse,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE, missingException } from './catalog.errors.js';
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

/**
 * Charge l'instantané Prisma et appelle `validateTour` (F-03).
 * La fonction pure n'est pas modifiée : elle ne lit pas la base.
 */
@Injectable()
export class TourPublicationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async validate(id: string): Promise<TourValidationResponse> {
    const row = await this.prisma.tour.findFirst({
      where: { id, deletedAt: null },
      select: tourSnapshotSelect,
    });
    if (row === null) {
      throw missingException(TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE);
    }
    const targets = await this.loadTargets(targetTourIds(row));
    const issues = validateTour(toSnapshot(row), targets);
    return TourValidationResponseSchema.parse({ issues });
  }

  private async loadTargets(ids: readonly string[]): Promise<FindTargetTour> {
    if (ids.length === 0) {
      return () => undefined;
    }
    const rows = await this.prisma.tour.findMany({
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
