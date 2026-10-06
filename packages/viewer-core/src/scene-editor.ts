import { HotspotResponse, Lang, localize, PanoramaDerivativesSchema, panoramaTileKey } from '@xplor/shared';
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

export function editorPanorama(asset: { derivatives?: unknown }): EditorPanorama {
  if (!asset.derivatives) {
    throw new Error('Les dérivés du panorama sont manquants ou incomplets.');
  }

  const parsed = PanoramaDerivativesSchema.safeParse(asset.derivatives);
  
  if (!parsed.success) {
    throw new Error('Les dérivés du panorama sont manquants ou incomplets.');
  }

  const data = parsed.data;

  return {
    width: data.tileGrid.cols * data.tileGrid.size,
    cols: data.tileGrid.cols,
    rows: data.tileGrid.rows,
    baseUrl: data.preview,
    tileUrl: (col: number, row: number) => panoramaTileKey(data.tilesPrefix, col, row),
  };
}
