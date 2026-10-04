import { TourGraph } from '@xplor/shared';

export function adjacentScenes(
  graph: TourGraph,
  sceneId: string
): { previous: string | null; next: string | null; index: number; total: number } {
  const index = graph.scenes.findIndex((scene) => scene.id === sceneId);

  if (index === -1) {
    throw new Error(`Scene with id '${sceneId}' not found in the tour graph.`);
  }

  const total = graph.scenes.length;
  const prevScene = index > 0 ? graph.scenes[index - 1] : undefined;
  const nextScene = index < total - 1 ? graph.scenes[index + 1] : undefined;

  const previous = prevScene ? prevScene.id : null;
  const next = nextScene ? nextScene.id : null;


  return {
    previous,
    next,
    index,
    total,
  };
}
