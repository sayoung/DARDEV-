import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Lang, TourGraph } from '@xplor/shared';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.service.js';
import { collectAssetIds, collectTargetTourIds } from './tour-graph-refs.js';
import type { SceneSource } from './tour-graph-scene.js';
import { toTourGraph, type TourSource } from './tour-graph.js';

export const TOUR_INCLUDE = {
  city: true,
  categories: {
    include: {
      category: true,
    },
  },
  coverAsset: true,
  scenes: {
    where: { deletedAt: null },
    orderBy: { weight: 'asc' },
    include: {
      panoramaAsset: true,
      ambientAsset: true,
      hotspots: true,
    },
  },
} as const satisfies Prisma.TourInclude;

@Injectable()
export class ViewerService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    @Inject(ENV) private env: Pick<Env, 'MEDIA_PUBLIC_URL'>,
  ) {}

  private async loadPublicTour(shareToken: string) {
    const tour = await this.prisma.tour.findFirst({
      where: {
        shareToken,
        publicShare: true,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: TOUR_INCLUDE,
    });

    if (!tour) {
      throw new NotFoundException();
    }

    return tour;
  }

  public async getPublicGraph(shareToken: string, lang: Lang): Promise<TourGraph> {
    const tour = await this.loadPublicTour(shareToken);
    return this.buildGraph(tour, lang);
  }

  private async buildGraph(
    tour: Prisma.TourGetPayload<{ include: typeof TOUR_INCLUDE }>,
    lang: Lang,
  ): Promise<TourGraph> {
    const scenes: SceneSource[] = tour.scenes.map((s) => ({
      id: s.id,
      title: s.title,
      caption: s.caption,
      weight: s.weight,
      initialYaw: s.initialYaw,
      initialPitch: s.initialPitch,
      initialZoom: s.initialZoom,
      panoramaAsset: { derivatives: s.panoramaAsset.derivatives },
      ambientAsset: s.ambientAsset ? { id: s.ambientAsset.id } : null,
      narration: s.narration,
      hotspots: s.hotspots.map((h) => ({
        id: h.id,
        type: h.type,
        yaw: h.yaw,
        pitch: h.pitch,
        label: h.label,
        targetSceneId: h.targetSceneId,
        targetTourId: h.targetTourId,
        targetTourSceneId: h.targetTourSceneId,
        body: h.body,
        mediaAssetIds: h.mediaAssetIds,
        url: h.url,
        icon: h.icon,
        arrivalYaw: h.arrivalYaw,
      })),
    }));

    const source: Omit<TourSource, 'linkedTours'> = {
      id: tour.id,
      contentVersion: tour.contentVersion,
      title: tour.title,
      summary: tour.summary,
      practicalInfo: tour.practicalInfo,
      startSceneId: tour.startSceneId,
      lat: tour.lat,
      lng: tour.lng,
      city: { name: tour.city.name },
      categories: tour.categories.map((c) => ({ category: { name: c.category.name } })),
      coverAsset: { derivatives: tour.coverAsset.derivatives },
      scenes,
    };

    const assetIds = collectAssetIds(scenes);
    const media = new Map<string, { url: string; mimeType: string }>();
    const assetUrlById = new Map<string, string>();

    if (assetIds.length > 0) {
      const assets = await this.prisma.asset.findMany({
        where: { id: { in: assetIds }, processingStatus: 'READY' },
      });
      for (const asset of assets) {
        const url = await this.storage.getSignedUrl(asset.originalKey, 3600);
        media.set(asset.id, { url, mimeType: asset.mimeType });
        assetUrlById.set(asset.id, url);
      }
    }

    const targetTourIds = collectTargetTourIds(scenes);
    let linkedTours: TourSource['linkedTours'] = [];
    let allowedTourIds = new Set<string>();

    if (targetTourIds.length > 0) {
      const tours = await this.prisma.tour.findMany({
        where: {
          id: { in: targetTourIds },
          status: 'PUBLISHED',
          publicShare: true,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          shareToken: true,
          coverAsset: true,
        },
      });

      linkedTours = tours.map((t) => ({
        id: t.id,
        title: t.title,
        shareToken: t.shareToken,
        coverAsset: { derivatives: t.coverAsset.derivatives },
      }));
      allowedTourIds = new Set(tours.map((t) => t.id));
    }

    return toTourGraph(
      { ...source, linkedTours },
      {
        lang,
        audience: 'public',
        mediaBase: this.env.MEDIA_PUBLIC_URL,
        media,
        assetUrlById,
        allowedTourIds,
      },
    );
  }

  public async getShareMeta(
    shareToken: string,
    lang: Lang,
  ): Promise<{ title: string; summary: string; coverUrl: string | null }> {
    const graph = await this.getPublicGraph(shareToken, lang);
    return {
      title: graph.title,
      summary: graph.summary,
      coverUrl: graph.coverUrl,
    };
  }
}
