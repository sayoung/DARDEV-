import { describe, it, expect } from 'vitest';
import { collectAssetIds, collectTargetTourIds } from './tour-graph-refs.js';
import { SceneSource } from './tour-graph-scene.js';

describe('tour-graph-refs', () => {
  describe('collectAssetIds', () => {
    it('returns empty list when no scenes or no assets', () => {
      expect(collectAssetIds([])).toEqual([]);
      expect(
        collectAssetIds([
          {
            id: 's1',
            title: {},
            caption: {},
            weight: 0,
            initialYaw: 0,
            initialPitch: 0,
            initialZoom: 0,
            panoramaAsset: { derivatives: {} },
            ambientAsset: null,
            narration: null,
            hotspots: [],
          },
        ])
      ).toEqual([]);
    });

    it('collects ambientAsset.id, narration strings, and mediaAssetIds without duplicates and sorted', () => {
      const scenes: SceneSource[] = [
        {
          id: 's1',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: { id: 'ambient-1' },
          narration: { fr: 'narration-fr', ar: 'narration-ar' },
          hotspots: [
            {
              id: 'h1',
              type: 'MEDIA',
              yaw: 0,
              pitch: 0,
              label: {},
              targetSceneId: null,
              targetTourId: null,
              targetTourSceneId: null,
              body: null,
              mediaAssetIds: ['media-2', 'media-1'],
              url: null,
              icon: null,
              arrivalYaw: null,
            },
          ],
        },
        {
          id: 's2',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: { id: 'ambient-1' },
          narration: { fr: 'narration-fr-2', en: 'narration-en', it: 'narration-it' },
          hotspots: [
            {
              id: 'h2',
              type: 'MEDIA',
              yaw: 0,
              pitch: 0,
              label: {},
              targetSceneId: null,
              targetTourId: null,
              targetTourSceneId: null,
              body: null,
              mediaAssetIds: ['media-1', 'media-3'],
              url: null,
              icon: null,
              arrivalYaw: null,
            },
          ],
        },
      ];

      expect(collectAssetIds(scenes)).toEqual([
        'ambient-1',
        'media-1',
        'media-2',
        'media-3',
        'narration-ar',
        'narration-en',
        'narration-fr',
        'narration-fr-2',
      ]);
    });

    it('ignores null or invalid narration formats', () => {
      const scenes: SceneSource[] = [
        {
          id: 's1',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: null,
          narration: 'invalid-string',
          hotspots: [],
        },
        {
          id: 's2',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: null,
          narration: ['array'],
          hotspots: [],
        },
        {
          id: 's3',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: null,
          narration: null,
          hotspots: [],
        },
      ];

      expect(collectAssetIds(scenes)).toEqual([]);
    });

    it('collects partial narration without fr and ignores non-string values', () => {
      const scenes: SceneSource[] = [
        {
          id: 's1',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: null,
          narration: { en: 'x', ar: 'y' },
          hotspots: [],
        },
        {
          id: 's2',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: null,
          narration: { fr: 'a', ar: 5 },
          hotspots: [],
        },
      ];

      expect(collectAssetIds(scenes)).toEqual(['a', 'x', 'y']);
    });
  });

  describe('collectTargetTourIds', () => {
    it('returns empty list when no scenes or no TOUR_LINK', () => {
      expect(collectTargetTourIds([])).toEqual([]);
    });

    it('collects targetTourId from TOUR_LINK hotspots without duplicates and sorted, ignoring SCENE_LINK', () => {
      const scenes: SceneSource[] = [
        {
          id: 's1',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: null,
          narration: null,
          hotspots: [
            {
              id: 'h1',
              type: 'TOUR_LINK',
              yaw: 0,
              pitch: 0,
              label: {},
              targetSceneId: null,
              targetTourId: 'tour-2',
              targetTourSceneId: null,
              body: null,
              mediaAssetIds: [],
              url: null,
              icon: null,
              arrivalYaw: null,
            },
            {
              id: 'h2',
              type: 'TOUR_LINK',
              yaw: 0,
              pitch: 0,
              label: {},
              targetSceneId: null,
              targetTourId: 'tour-1',
              targetTourSceneId: null,
              body: null,
              mediaAssetIds: [],
              url: null,
              icon: null,
              arrivalYaw: null,
            },
          ],
        },
        {
          id: 's2',
          title: {},
          caption: {},
          weight: 0,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 0,
          panoramaAsset: { derivatives: {} },
          ambientAsset: null,
          narration: null,
          hotspots: [
            {
              id: 'h3',
              type: 'SCENE_LINK',
              yaw: 0,
              pitch: 0,
              label: {},
              targetSceneId: 'scene-2',
              targetTourId: 'ignored-tour-3',
              targetTourSceneId: null,
              body: null,
              mediaAssetIds: [],
              url: null,
              icon: null,
              arrivalYaw: null,
            },
            {
              id: 'h4',
              type: 'TOUR_LINK',
              yaw: 0,
              pitch: 0,
              label: {},
              targetSceneId: null,
              targetTourId: 'tour-2',
              targetTourSceneId: null,
              body: null,
              mediaAssetIds: [],
              url: null,
              icon: null,
              arrivalYaw: null,
            },
            {
              id: 'h5',
              type: 'TOUR_LINK',
              yaw: 0,
              pitch: 0,
              label: {},
              targetSceneId: null,
              targetTourId: null,
              targetTourSceneId: null,
              body: null,
              mediaAssetIds: [],
              url: null,
              icon: null,
              arrivalYaw: null,
            },
          ],
        },
      ];

      expect(collectTargetTourIds(scenes)).toEqual(['tour-1', 'tour-2']);
    });
  });
});
