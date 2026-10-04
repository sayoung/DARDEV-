import { Viewer } from '@photo-sphere-viewer/core';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { MarkersPlugin, type MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
import { GalleryPlugin } from '@photo-sphere-viewer/gallery-plugin';
import type { TourGraph } from '@xplor/shared';
import { tourPluginOptions } from './tour-config.js';
import { toMarkers } from './scene-markers.js';

/**
 * CSS requirements for the application mounting this viewer:
 * import '@photo-sphere-viewer/core/index.css';
 * import '@photo-sphere-viewer/markers-plugin/index.css';
 * import '@photo-sphere-viewer/virtual-tour-plugin/index.css';
 * import '@photo-sphere-viewer/gallery-plugin/index.css';
 */

export function mountViewer(
  container: HTMLElement,
  graph: TourGraph,
  opts?: { sceneId?: string | null; onSceneChange?: (sceneId: string) => void }
): { destroy(): void; currentSceneId(): string } {
  const viewer = new Viewer({
    container,
    plugins: [
      [VirtualTourPlugin, tourPluginOptions(graph, opts?.sceneId)],
      [MarkersPlugin, {}],
      [GalleryPlugin, {}],
    ],
  });

  const tourPlugin = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);
  const markersPlugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);

  tourPlugin.addEventListener('node-changed', ({ node }) => {
    const scene = graph.scenes.find((s) => s.id === node.id);
    if (scene) {
      const markers = toMarkers(scene);
      const markerConfigs: MarkerConfig[] = markers.map((m) => ({
        id: m.id,
        position: m.position,
        tooltip: m.tooltip,
        className: `xplor-marker xplor-marker-${m.kind}`,
        html: `<div class="marker-icon"><span class="icon-${m.icon}"></span></div>`,
      }));
      markersPlugin.setMarkers(markerConfigs);
    }
    
    if (opts?.onSceneChange) {
      opts.onSceneChange(node.id);
    }
  });

  return {
    destroy: () => {
      viewer.destroy();
    },
    currentSceneId: () => {
      const node = tourPlugin.getCurrentNode();
      return node.id;
    },
  };
}
