import { HotspotResponse, Lang, localize, PanoramaUrls } from '@xplor/shared';
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin, type MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
import { EquirectangularTilesAdapter, type EquirectangularTilesAdapterConfig } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
import { hotspotKind } from './scene-markers.js';
import { EditorPanorama } from './tour-nodes.js';

export function normalizeYaw(yaw: number): number {
  let y = yaw % (2 * Math.PI);
  if (y > Math.PI) {
    y -= 2 * Math.PI;
  } else if (y <= -Math.PI) {
    y += 2 * Math.PI;
  }
  return y;
}

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

export function toEditorMarkerConfig(m: EditorMarker): MarkerConfig {
  return {
    id: m.id,
    position: m.position,
    tooltip: m.tooltip,
    className: m.className,
    html: '<div class="editor-marker"></div>',
    anchor: 'center center',
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
    onMarkerMove?: (id: string, yaw: number, pitch: number) => void;
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

  const markerConfigs: MarkerConfig[] = options.markers.map(toEditorMarkerConfig);
  markersPlugin.setMarkers(markerConfigs);

  viewer.addEventListener('click', (e) => {
    if (e.data.rightclick) {
      return;
    }
    
    if (e.data.target?.closest('.psv-marker')) {
       return;
    }
    
    options.onPanoramaClick(normalizeYaw(e.data.yaw), e.data.pitch);
  });

  markersPlugin.addEventListener('select-marker', ({ marker }) => {
    options.onMarkerSelect(marker.id);
  });

  let handlePointerDown: ((e: PointerEvent) => void) | undefined;
  let handlePointerMove: ((e: PointerEvent) => void) | undefined;
  let handlePointerUp: ((e: PointerEvent) => void) | undefined;
  let handlePointerCancel: ((e: PointerEvent) => void) | undefined;

  if (options.onMarkerMove) {
    const onMarkerMoveCb = options.onMarkerMove;
    let draggedMarkerId: string | null = null;
    let startYaw: number | null = null;
    let startPitch: number | null = null;
    let lastYaw: number | null = null;
    let lastPitch: number | null = null;

    handlePointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const markerEl = target.closest('.psv-marker');
      if (!markerEl) return;

      let id: string | undefined;
      if (markerEl instanceof HTMLElement) {
        id = markerEl.dataset.psvMarker;
      }
      if (!id) {
        const marker = markersPlugin.getMarkers().find((m) => m.domElement === markerEl);
        if (marker) {
          id = marker.id;
        }
      }
      if (typeof id !== 'string') return;

      const spherical = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: e.clientX, y: e.clientY }) as { yaw: number; pitch: number } | null;
      if (!spherical) return;

      e.stopPropagation();
      draggedMarkerId = id;
      
      startYaw = spherical.yaw;
      startPitch = spherical.pitch;
      lastYaw = spherical.yaw;
      lastPitch = spherical.pitch;
    };

    handlePointerMove = (e: PointerEvent) => {
      if (!draggedMarkerId) return;
      
      const spherical = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: e.clientX, y: e.clientY }) as { yaw: number; pitch: number } | null;
      if (!spherical) return;
      
      lastYaw = spherical.yaw;
      lastPitch = spherical.pitch;
      
      markersPlugin.updateMarker({
        id: draggedMarkerId,
        position: { yaw: lastYaw, pitch: lastPitch }
      });
    };

    handlePointerUp = () => {
      if (!draggedMarkerId) return;
      
      if (lastYaw !== null && lastPitch !== null && startYaw !== null && startPitch !== null) {
        if (lastYaw !== startYaw || lastPitch !== startPitch) {
          onMarkerMoveCb(draggedMarkerId, normalizeYaw(lastYaw), lastPitch);
        }
      }
      
      draggedMarkerId = null;
      startYaw = null;
      startPitch = null;
      lastYaw = null;
      lastPitch = null;
    };

    handlePointerCancel = () => {
      draggedMarkerId = null;
      startYaw = null;
      startPitch = null;
      lastYaw = null;
      lastPitch = null;
    };

    viewer.container.addEventListener('pointerdown', handlePointerDown);
    viewer.container.addEventListener('pointermove', handlePointerMove);
    viewer.container.addEventListener('pointerup', handlePointerUp);
    viewer.container.addEventListener('pointercancel', handlePointerCancel);
  }

  return {
    setMarkers: (markers: EditorMarker[]) => {
      const configs: MarkerConfig[] = markers.map(toEditorMarkerConfig);
      markersPlugin.setMarkers(configs);
    },
    getView: () => {
      const pos = viewer.getPosition();
      const zoom = viewer.getZoomLevel();
      return { yaw: pos.yaw, pitch: pos.pitch, zoom };
    },
    destroy: () => {
      if (handlePointerDown) viewer.container.removeEventListener('pointerdown', handlePointerDown);
      if (handlePointerMove) viewer.container.removeEventListener('pointermove', handlePointerMove);
      if (handlePointerUp) viewer.container.removeEventListener('pointerup', handlePointerUp);
      if (handlePointerCancel) viewer.container.removeEventListener('pointercancel', handlePointerCancel);
      viewer.destroy();
    },
  };
}
