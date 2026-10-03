import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HotspotType } from '@xplor/shared';

import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ViewerService } from './viewer.service.js';

describe('ViewerService', () => {
  let viewerService: ViewerService;

  const findFirstMock = vi.fn();
  const tourFindManyMock = vi.fn();
  const assetFindManyMock = vi.fn();

  const prismaMock = {
    tour: {
      findFirst: findFirstMock,
      findMany: tourFindManyMock,
    },
    asset: {
      findMany: assetFindManyMock,
    },
  } as unknown as PrismaService;

  const getSignedUrlMock = vi.fn();
  const storageMock = {
    getSignedUrl: getSignedUrlMock,
  } as unknown as StorageService;

  const envMock: Pick<Env, 'MEDIA_PUBLIC_URL'> = {
    MEDIA_PUBLIC_URL: 'https://cdn.example.com',
  };

  const validDerivatives = {
    preview: '/pano/preview.jpg',
    web: '/pano/web.jpg',
    thumb: '/pano/thumb.jpg',
    tilesPrefix: '/pano/tiles/',
    tileGrid: { cols: 4, rows: 2, size: 512 },
  };

  const baseFakeTour = {
    id: 'some-tour-id',
    contentVersion: 1,
    title: { fr: 'Titre FR' },
    summary: { fr: 'Résumé' },
    practicalInfo: null,
    startSceneId: 'scene-1',
    lat: 34.0,
    lng: -6.8,
    city: { name: { fr: 'Ville' } },
    categories: [],
    coverAsset: { derivatives: validDerivatives },
    scenes: [
      {
        id: 'scene-1',
        title: { fr: 'Scène 1' },
        caption: null,
        weight: 1,
        initialYaw: 0,
        initialPitch: 0,
        initialZoom: 1,
        panoramaAsset: { derivatives: validDerivatives },
        ambientAsset: null,
        narration: null,
        hotspots: [],
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();

    assetFindManyMock.mockResolvedValue([]);
    tourFindManyMock.mockResolvedValue([]);
    getSignedUrlMock.mockResolvedValue('https://signed.url');

    viewerService = new ViewerService(prismaMock, storageMock, envMock);
  });

  describe('getPublicGraph', () => {
    it('should throw NotFoundException if tour is not found', async () => {
      findFirstMock.mockResolvedValue(null);

      await expect(viewerService.getPublicGraph('fake-token', 'fr')).rejects.toThrow(
        NotFoundException,
      );

      expect(findFirstMock).toHaveBeenCalledTimes(1);
    });

    it('should query Prisma with correct parameters and construct the graph', async () => {
      const fakeTour = {
        ...baseFakeTour,
        scenes: [
          {
            ...baseFakeTour.scenes[0],
            hotspots: [
              {
                id: 'hs-1',
                type: 'MEDIA',
                yaw: 0,
                pitch: 0,
                label: { fr: 'Média' },
                targetSceneId: null,
                targetTourId: null,
                targetTourSceneId: null,
                body: null,
                mediaAssetIds: ['asset-1', 'asset-not-ready'],
                url: null,
                icon: null,
                arrivalYaw: null,
              },
              {
                id: 'hs-2',
                type: 'TOUR_LINK',
                yaw: 90,
                pitch: 0,
                label: { fr: 'Lien' },
                targetSceneId: null,
                targetTourId: 'tour-2',
                targetTourSceneId: null,
                body: null,
                mediaAssetIds: [],
                url: null,
                icon: null,
                arrivalYaw: null,
              },
            ],
          },
        ],
      };

      findFirstMock.mockResolvedValue(fakeTour);

      assetFindManyMock.mockResolvedValue([
        { id: 'asset-1', originalKey: 'k', processingStatus: 'READY', mimeType: 'image/jpeg' },
      ]);

      tourFindManyMock.mockResolvedValue([
        {
          id: 'tour-2',
          title: { fr: 'Tour lié' },
          shareToken: 'token2',
          coverAsset: { derivatives: validDerivatives },
        },
      ]);

      const graph = await viewerService.getPublicGraph('fake-token', 'fr');

      expect(findFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shareToken: 'fake-token',
            publicShare: true,
            status: 'PUBLISHED',
            deletedAt: null,
          },
        }),
      );

      expect(assetFindManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['asset-1', 'asset-not-ready'] }, processingStatus: 'READY' },
      });

      expect(getSignedUrlMock).toHaveBeenCalledWith('k', 3600);

      expect(tourFindManyMock).toHaveBeenCalledWith({
        where: {
          id: { in: ['tour-2'] },
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

      expect(graph.id).toBe('some-tour-id');
      expect(graph.scenes[0]).toBeDefined();

      const scene = graph.scenes[0];
      if (!scene) throw new Error('Scene is missing');

      expect(scene.hotspots).toBeDefined();

      const hotspots = scene.hotspots;
      const mediaHotspot = hotspots.find((h) => h.type === HotspotType.MEDIA);
      expect(mediaHotspot).toBeDefined();
      expect(mediaHotspot).toMatchObject({
        media: [{ url: 'https://signed.url', mimeType: 'image/jpeg' }],
      });

      const tourLinkHotspot = hotspots.find((h) => h.type === HotspotType.TOUR_LINK);
      expect(tourLinkHotspot).toBeDefined();
      expect(tourLinkHotspot).toMatchObject({
        targetTourId: 'tour-2',
      });

      expect(graph.linkedTours.length).toBe(1);
      const firstLinkedTour = graph.linkedTours[0];
      if (!firstLinkedTour) throw new Error('Missing linked tour');
      expect(firstLinkedTour.id).toBe('tour-2');
      expect(firstLinkedTour.title).toBe('Tour lié');
      expect(typeof firstLinkedTour.coverUrl).toBe('string');
      expect(firstLinkedTour.availableOffline).toBe(false);
      expect(firstLinkedTour.shareToken).toBe('token2');
    });

    it('should ignore non-READY assets and not expose media', async () => {
      const fakeTour = {
        ...baseFakeTour,
        scenes: [
          {
            ...baseFakeTour.scenes[0],
            hotspots: [
              {
                id: 'hs-1',
                type: 'MEDIA',
                yaw: 0,
                pitch: 0,
                label: { fr: 'Média' },
                targetSceneId: null,
                targetTourId: null,
                targetTourSceneId: null,
                body: null,
                mediaAssetIds: ['asset-not-ready'],
                url: null,
                icon: null,
                arrivalYaw: null,
              },
            ],
          },
        ],
      };

      findFirstMock.mockResolvedValue(fakeTour);
      // Prisma ne renvoie pas l'asset car il n'est pas READY
      assetFindManyMock.mockResolvedValue([]);

      const graph = await viewerService.getPublicGraph('fake-token', 'fr');

      expect(assetFindManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['asset-not-ready'] }, processingStatus: 'READY' },
      });
      expect(getSignedUrlMock).not.toHaveBeenCalled();

      const scene = graph.scenes[0];
      if (!scene) throw new Error('Scene is missing');

      const mediaHotspot = scene.hotspots.find((h) => h.type === HotspotType.MEDIA);
      expect(mediaHotspot).toBeUndefined();
    });

    it('should not expose linked tours if not found in Prisma', async () => {
      const fakeTour = {
        ...baseFakeTour,
        scenes: [
          {
            ...baseFakeTour.scenes[0],
            hotspots: [
              {
                id: 'hs-2',
                type: 'TOUR_LINK',
                yaw: 90,
                pitch: 0,
                label: { fr: 'Lien' },
                targetSceneId: null,
                targetTourId: 'tour-2',
                targetTourSceneId: null,
                body: null,
                mediaAssetIds: [],
                url: null,
                icon: null,
                arrivalYaw: null,
              },
            ],
          },
        ],
      };

      findFirstMock.mockResolvedValue(fakeTour);
      // Prisma ne renvoie rien
      tourFindManyMock.mockResolvedValue([]);

      const graph = await viewerService.getPublicGraph('fake-token', 'fr');

      expect(tourFindManyMock).toHaveBeenCalled();
      expect(graph.linkedTours.length).toBe(0);

      const scene = graph.scenes[0];
      if (!scene) throw new Error('Scene is missing');

      const tourLinkHotspot = scene.hotspots.find((h) => h.type === HotspotType.TOUR_LINK);
      expect(tourLinkHotspot).toBeUndefined(); // le hotspot est filtré par toTourGraph si targetTourId n'est pas dans allowedTourIds
    });

    it('should not call asset or tour findMany if no media or tour link hotspots are present', async () => {
      findFirstMock.mockResolvedValue(baseFakeTour);

      await viewerService.getPublicGraph('fake-token', 'fr');

      expect(assetFindManyMock).not.toHaveBeenCalled();
      expect(tourFindManyMock).not.toHaveBeenCalled();
    });
  });
});
