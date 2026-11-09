import { TourGraph, HotspotType } from '@xplor/shared';
import type { VirtualTourNode } from '@photo-sphere-viewer/virtual-tour-plugin';

export type EditorPanorama = {
  width: number;
  cols: number;
  rows: number;
  baseUrl: string;
  tileUrl: (col: number, row: number) => string;
};

export type TourLinkDir = 'next' | 'prev' | 'other';

export function resolveTourLinkDir(
  currentIndex: number,
  targetIndex: number,
  totalScenes: number,
): TourLinkDir {
  if (
    totalScenes <= 0 ||
    currentIndex < 0 ||
    currentIndex >= totalScenes ||
    targetIndex < 0 ||
    targetIndex >= totalScenes
  ) {
    return 'other';
  }

  const nextIndex = (currentIndex + 1) % totalScenes;
  const prevIndex = (currentIndex - 1 + totalScenes) % totalScenes;

  // Quand il n'y a qu'une ou deux scènes et que next et prev coïncident, 'next' l'emporte.
  if (targetIndex === nextIndex) {
    return 'next';
  }
  if (targetIndex === prevIndex) {
    return 'prev';
  }
  return 'other';
}

export function toTourNodes(graph: TourGraph): VirtualTourNode[] {
  const sceneIndexById = new Map<string, number>();
  graph.scenes.forEach((s, idx) => {
    sceneIndexById.set(s.id, idx);
  });
  const totalScenes = graph.scenes.length;

  return graph.scenes.map((scene, currentIndex) => {
    const links = scene.hotspots.flatMap((h) => {
      if (h.type === HotspotType.SCENE_LINK) {
        const targetIndex = sceneIndexById.get(h.targetSceneId);
        if (targetIndex !== undefined) {
          const dir = resolveTourLinkDir(currentIndex, targetIndex, totalScenes);
          return [
            {
              nodeId: h.targetSceneId,
              position: {
                yaw: h.yaw,
                pitch: h.pitch,
              },
              data: {
                arrivalYaw: h.arrivalYaw,
                label: h.label,
                dir,
              },
            },
          ];
        }
      }
      return [];
    });

    const node: VirtualTourNode = {
      id: scene.id,
      panorama: {
        width: scene.panorama.tiles.width,
        cols: scene.panorama.tiles.cols,
        rows: scene.panorama.tiles.rows,
        baseUrl: scene.panorama.preview,
        tileUrl: (col: number, row: number) => {
          return scene.panorama.tiles.baseUrl
            .replace('{col}', col.toString())
            .replace('{row}', row.toString());
        },
      },
      thumbnail: scene.thumb,
      name: scene.title,
      links,
    };

    if (scene.caption !== null) {
      node.caption = scene.caption;
    }

    return node;
  });
}
