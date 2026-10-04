import { TourGraph, HotspotType } from '@xplor/shared';
import type { VirtualTourNode } from '@photo-sphere-viewer/virtual-tour-plugin';

export function toTourNodes(graph: TourGraph): VirtualTourNode[] {
  const sceneIds = new Set(graph.scenes.map((s) => s.id));

  return graph.scenes.map((scene) => {
    const links = scene.hotspots.flatMap((h) => {
      if (h.type === HotspotType.SCENE_LINK && sceneIds.has(h.targetSceneId)) {
        return [
          {
            nodeId: h.targetSceneId,
            position: {
              yaw: h.yaw,
              pitch: h.pitch,
            },
          },
        ];
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
