import { HotspotResponse, Lang, localize } from '@xplor/shared';
import { hotspotKind } from './scene-markers.js';

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
