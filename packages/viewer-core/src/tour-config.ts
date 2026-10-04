import type { VirtualTourPluginConfig } from '@photo-sphere-viewer/virtual-tour-plugin';
import type { TourGraph } from '@xplor/shared';
import { toTourNodes } from './tour-nodes.js';

export const TRANSITION_MS = 800;

export function tourPluginOptions(graph: TourGraph, sceneId?: string | null): VirtualTourPluginConfig {
  const nodes = toTourNodes(graph);
  
  let startNodeId = graph.startSceneId;
  if (sceneId && graph.scenes.some((s) => s.id === sceneId)) {
    startNodeId = sceneId;
  }

  return {
    nodes,
    positionMode: 'manual',
    renderMode: '3d',
    startNodeId,
    transitionOptions: {
      effect: 'fade',
      speed: TRANSITION_MS,
    },
  };
}
