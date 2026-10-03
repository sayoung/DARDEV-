import { LocalizedTextSchema } from '@xplor/shared';
import { SceneSource } from './tour-graph-scene.js';

export function collectAssetIds(scenes: SceneSource[]): string[] {
  const ids = new Set<string>();

  for (const scene of scenes) {
    if (scene.ambientAsset?.id) {
      ids.add(scene.ambientAsset.id);
    }

    const parsedNar = LocalizedTextSchema.safeParse(scene.narration);
    if (parsedNar.success) {
      for (const val of Object.values(parsedNar.data)) {
        if (typeof val === 'string' && val.length > 0) {
          ids.add(val);
        }
      }
    }

    if (Array.isArray(scene.hotspots)) {
      for (const hotspot of scene.hotspots) {
        if (Array.isArray(hotspot.mediaAssetIds)) {
          for (const assetId of hotspot.mediaAssetIds) {
            ids.add(assetId);
          }
        }
      }
    }
  }

  return Array.from(ids).sort();
}

export function collectTargetTourIds(scenes: SceneSource[]): string[] {
  const ids = new Set<string>();

  for (const scene of scenes) {
    if (Array.isArray(scene.hotspots)) {
      for (const hotspot of scene.hotspots) {
        if (hotspot.type === 'TOUR_LINK' && typeof hotspot.targetTourId === 'string') {
          ids.add(hotspot.targetTourId);
        }
      }
    }
  }

  return Array.from(ids).sort();
}
