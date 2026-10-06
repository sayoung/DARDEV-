import { HotspotResponse, Lang, localize, PanoramaUrls } from '@xplor/shared';
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin, type MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
import { EquirectangularTilesAdapter, type EquirectangularTilesAdapterConfig } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
import { hotspotKind } from './scene-markers.js';
import { EditorPanorama } from './tour-nodes.js';

export type EditorMarker = {
  id: string;
  position: {
    yaw: number;
    pitch: number;
  };
  tooltip: string;
  className: string;
};

export function editorMarkers(hotspots: HotspotResponse[], lang: Lang): EditorMarker[] {
  return hotspots.map((hotspot) => {
    const kind = hotspotKind(hotspot.type);
    return {
      id: hotspot.id,
      position: {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
      },
      tooltip: localize(hotspot.label, lang),
      className: `xplor-marker xplor-marker-${kind}`,
    };
  });
}

export function editorPanorama(asset: { panorama: PanoramaUrls | null }): EditorPanorama {
  if (!asset.panorama) {
    throw new Error('Les dérivés du panorama sont manquants ou incomplets.');
  }

  const panorama = asset.panorama;
  const tiles = panorama.tiles;

  return {
    width: tiles.width,
    cols: tiles.cols,
    rows: tiles.rows,
    baseUrl: panorama.preview,
    tileUrl: (col: number, row: number) => tiles.baseUrl.replace('{col}', String(col)).replace('{row}', String(row)),
  };
}

export function mountSceneEditor(
  container: HTMLElement,
  options: {
    panorama: EditorPanorama;
    markers: EditorMarker[];
    initialView: { yaw: number; pitch: number; zoom: number };
    onPanoramaClick: (yaw: number, pitch: number) => void;
    onMarkerSelect: (id: string) => void;
  }
) {
  const adapterConfig: EquirectangularTilesAdapterConfig = {
    showErrorTile: true,
  };

  const viewer = new Viewer({
    container,
    adapter: [EquirectangularTilesAdapter, adapterConfig],
    panorama: options.panorama,
    defaultYaw: options.initialView.yaw,
    defaultPitch: options.initialView.pitch,
    defaultZoomLvl: options.initialView.zoom,
    plugins: [
      [MarkersPlugin, {}],
    ],
  });

  const markersPlugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);

  const markerConfigs: MarkerConfig[] = options.markers.map((m) => ({
    id: m.id,
    position: m.position,
    tooltip: m.tooltip,
    className: m.className,
  }));
  markersPlugin.setMarkers(markerConfigs);

  viewer.addEventListener('click', (e) => {
    if (e.data.rightclick) {
      return;
    }
    
    if (e.data.target?.closest('.psv-marker')) {
       return;
    }
    
    options.onPanoramaClick(e.data.yaw, e.data.pitch);
  });

  markersPlugin.addEventListener('select-marker', ({ marker }) => {
    options.onMarkerSelect(marker.id);
  });

  return {
    setMarkers: (markers: EditorMarker[]) => {
      const configs: MarkerConfig[] = markers.map((m) => ({
        id: m.id,
        position: m.position,
        tooltip: m.tooltip,
        className: m.className,
      }));
      markersPlugin.setMarkers(configs);
    },
    getView: () => {
      const pos = viewer.getPosition();
      const zoom = viewer.getZoomLevel();
      return { yaw: pos.yaw, pitch: pos.pitch, zoom };
    },
    destroy: () => {
      viewer.destroy();
    },
  };
}
