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

export function isSphericalPosition(pos: unknown): pos is { yaw: number; pitch: number } {
  return typeof pos === 'object' && pos !== null && 'yaw' in pos && 'pitch' in pos && typeof pos.yaw === 'number' && typeof pos.pitch === 'number';
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

  let currentSelectedMarkerId: string | null = null;
  const updateMarkerSelectionClasses = (selectedId: string | null) => {
    currentSelectedMarkerId = selectedId;
    markersPlugin.getMarkers().forEach((m) => {
      const cls = m.config.className || '';
      const isSelected = m.id === selectedId;
      const hasClass = cls.includes('xplor-marker-selected');
      if (isSelected && !hasClass) {
        markersPlugin.updateMarker({ id: m.id, className: cls + ' xplor-marker-selected' });
      } else if (!isSelected && hasClass) {
        markersPlugin.updateMarker({ id: m.id, className: cls.replace(' xplor-marker-selected', '').trim() });
      }
    });
  };

  markersPlugin.addEventListener('select-marker', ({ marker }) => {
    options.onMarkerSelect(marker.id);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!currentSelectedMarkerId) return;
    const activeEl = document.activeElement;
    if (activeEl) {
      const tag = activeEl.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    }

    let yawOffset = 0;
    let pitchOffset = 0;
    const step = e.shiftKey ? 5 * Math.PI / 180 : 1 * Math.PI / 180;
    
    if (e.key === 'ArrowLeft') yawOffset = -step;
    if (e.key === 'ArrowRight') yawOffset = step;
    if (e.key === 'ArrowUp') pitchOffset = step;
    if (e.key === 'ArrowDown') pitchOffset = -step;
    
    if (yawOffset !== 0 || pitchOffset !== 0) {
      e.preventDefault();
      const marker = markersPlugin.getMarker(currentSelectedMarkerId);
      if (isSphericalPosition(marker.config.position)) {
        const pos = marker.config.position;
        const newYaw = normalizeYaw(pos.yaw + yawOffset);
        const newPitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pos.pitch + pitchOffset));
        markersPlugin.updateMarker({ id: marker.id, position: { yaw: newYaw, pitch: newPitch } });
        options.onMarkerMove?.(marker.id, newYaw, newPitch);
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  let handlePointerDown: ((e: PointerEvent) => void) | undefined;
  let handlePointerMove: ((e: PointerEvent) => void) | undefined;
  let handlePointerUp: ((e: PointerEvent) => void) | undefined;

  if (options.onMarkerMove) {
    const onMarkerMoveCb = options.onMarkerMove;
    let draggedMarkerId: string | null = null;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

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
        if (marker) id = marker.id;
      }
      if (typeof id !== 'string') return;

      e.stopPropagation();
      e.preventDefault();
      
      draggedMarkerId = id;
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      
      viewer.container.setPointerCapture(e.pointerId);
    };

    handlePointerMove = (e: PointerEvent) => {
      if (!draggedMarkerId) return;
      
      if (!isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (dx * dx + dy * dy >= 16) {
          isDragging = true;
          viewer.setOption('mousemove', false);
        } else {
          return;
        }
      }

      const spherical = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: e.clientX, y: e.clientY });
      if (!isSphericalPosition(spherical)) return;
      
      markersPlugin.updateMarker({
        id: draggedMarkerId,
        position: { yaw: spherical.yaw, pitch: spherical.pitch }
      });
    };

    handlePointerUp = (e: PointerEvent) => {
      if (!draggedMarkerId) return;
      
      viewer.container.releasePointerCapture(e.pointerId);
      
      if (isDragging) {
        const spherical = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: e.clientX, y: e.clientY });
        if (isSphericalPosition(spherical)) {
          onMarkerMoveCb(draggedMarkerId, normalizeYaw(spherical.yaw), spherical.pitch);
        }
        viewer.setOption('mousemove', true);
      }
      
      draggedMarkerId = null;
      isDragging = false;
    };

    viewer.container.addEventListener('pointerdown', handlePointerDown, true);
    viewer.container.addEventListener('pointermove', handlePointerMove, true);
    viewer.container.addEventListener('pointerup', handlePointerUp, true);
    viewer.container.addEventListener('pointercancel', handlePointerUp, true);
  }

  return {
    setMarkers: (markers: EditorMarker[]) => {
      const configs: MarkerConfig[] = markers.map(m => {
        const cfg = toEditorMarkerConfig(m);
        if (currentSelectedMarkerId === cfg.id) {
           cfg.className = (cfg.className || '') + ' xplor-marker-selected';
        }
        return cfg;
      });
      markersPlugin.setMarkers(configs);
    },
    setSelectedMarker: (id: string | null) => {
      updateMarkerSelectionClasses(id);
    },
    getView: () => {
      const pos = viewer.getPosition();
      const zoom = viewer.getZoomLevel();
      return { yaw: pos.yaw, pitch: pos.pitch, zoom };
    },
    destroy: () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (handlePointerDown) viewer.container.removeEventListener('pointerdown', handlePointerDown, true);
      if (handlePointerMove) viewer.container.removeEventListener('pointermove', handlePointerMove, true);
      if (handlePointerUp) {
        viewer.container.removeEventListener('pointerup', handlePointerUp, true);
        viewer.container.removeEventListener('pointercancel', handlePointerUp, true);
      }
      viewer.destroy();
    },
  };
}
