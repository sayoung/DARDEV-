import { HotspotType, type TourLinkMap } from '@xplor/shared';

import { reachableFrom } from './publication-rules.js';

export function buildTourLinkMap(input: {
  startSceneId: string | null;
  scenes: readonly {
    id: string;
    title: string;
    deleted: boolean;
    hotspots: readonly {
      id: string;
      type: HotspotType;
      targetSceneId?: string | null;
      targetTourId?: string | null;
      targetTourTitle?: string | null;
    }[];
  }[];
}): TourLinkMap {
  const activeScenes = input.scenes.filter((s) => !s.deleted);
  const activeSceneIds = new Set(activeScenes.map((s) => s.id));

  const startSceneId = input.startSceneId;
  const validStart = startSceneId !== null && activeSceneIds.has(startSceneId);

  let reachable: Set<string>;
  if (validStart) {
    const neighbours = new Map<string, readonly string[]>();
    for (const scene of activeScenes) {
      const links: string[] = [];
      for (const h of scene.hotspots) {
        if (
          h.type === HotspotType.SCENE_LINK &&
          h.targetSceneId != null &&
          activeSceneIds.has(h.targetSceneId)
        ) {
          links.push(h.targetSceneId);
        }
      }
      neighbours.set(scene.id, links);
    }
    reachable = reachableFrom(startSceneId, neighbours);
  } else {
    reachable = new Set();
  }

  const nodes: TourLinkMap['nodes'] = activeScenes.map((scene) => ({
    id: scene.id,
    kind: 'scene',
    label: scene.title,
    isStart: scene.id === startSceneId,
    orphan: !reachable.has(scene.id),
  }));

  const edges: TourLinkMap['edges'] = [];
  for (const scene of activeScenes) {
    for (const hotspot of scene.hotspots) {
      if (
        hotspot.type === HotspotType.SCENE_LINK &&
        hotspot.targetSceneId != null &&
        activeSceneIds.has(hotspot.targetSceneId)
      ) {
        edges.push({
          id: hotspot.id,
          source: scene.id,
          target: hotspot.targetSceneId,
          kind: 'scene_link',
        });
      }
    }
  }

  return { nodes, edges };
}
