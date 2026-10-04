import { TourGraph, HotspotType } from '@xplor/shared';

export type TourNode = {
  id: string;
  panorama: string;
  thumbnail: string;
  name: string;
  caption?: string;
  links: {
    nodeId: string;
    position: {
      yaw: number;
      pitch: number;
    };
  }[];
};

export function toTourNodes(graph: TourGraph): TourNode[] {
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

    const node: TourNode = {
      id: scene.id,
      panorama: scene.panorama.web,
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
