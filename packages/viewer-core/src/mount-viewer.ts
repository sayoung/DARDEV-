import { Viewer } from '@photo-sphere-viewer/core';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { MarkersPlugin, type MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
import { GalleryPlugin } from '@photo-sphere-viewer/gallery-plugin';
import { EquirectangularTilesAdapter, type EquirectangularTilesAdapterConfig, type EquirectangularTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
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
  opts?: { sceneId?: string | null; onSceneChange?: (sceneId: string) => void; onHotspotClick?: (hotspotId: string) => void }
): { destroy(): void; currentSceneId(): string; goToScene(sceneId: string): Promise<void> } {
  let startSceneId = graph.startSceneId;
  if (opts?.sceneId && graph.scenes.some((s) => s.id === opts.sceneId)) {
    startSceneId = opts.sceneId;
  }
  const startScene = graph.scenes.find((s) => s.id === startSceneId) || graph.scenes[0];

  let initialPanorama: EquirectangularTilesPanorama | undefined;
  if (startScene) {
    initialPanorama = {
      width: startScene.panorama.tiles.width,
      cols: startScene.panorama.tiles.cols,
      rows: startScene.panorama.tiles.rows,
      baseUrl: startScene.panorama.preview,
      tileUrl: (col: number, row: number) => {
        return startScene.panorama.tiles.baseUrl
          .replace('{col}', col.toString())
          .replace('{row}', row.toString());
      },
    };
  }

  const adapterConfig: EquirectangularTilesAdapterConfig = {
    showErrorTile: true,
  };

  const viewer = new Viewer({
    container,
    adapter: [EquirectangularTilesAdapter, adapterConfig],
    panorama: initialPanorama,
    plugins: [
      [VirtualTourPlugin, tourPluginOptions(graph, opts?.sceneId)],
      [MarkersPlugin, {}],
      [GalleryPlugin, {}],
    ],
  });

  const tourPlugin = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);
  const markersPlugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);

  markersPlugin.addEventListener('select-marker', ({ marker }) => {
    if (opts?.onHotspotClick) {
      opts.onHotspotClick(marker.id);
    }
  });

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
    goToScene: async (sceneId: string) => {
      await tourPlugin.setCurrentNode(sceneId);
    },
  };
}
