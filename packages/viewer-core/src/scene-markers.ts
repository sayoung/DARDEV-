import { TourGraphScene, HotspotType, HotspotIcon } from '@xplor/shared';

export type SceneMarker = {
  id: string;
  position: {
    yaw: number;
    pitch: number;
  };
  kind: 'tour-link' | 'info' | 'media' | 'url';
  tooltip: string;
  icon: HotspotIcon;
};

export function hotspotKind(type: HotspotType): 'tour-link' | 'info' | 'media' | 'url' | 'scene-link' {
  switch (type) {
    case HotspotType.TOUR_LINK:
      return 'tour-link';
    case HotspotType.INFO:
      return 'info';
    case HotspotType.MEDIA:
      return 'media';
    case HotspotType.URL:
      return 'url';
    case HotspotType.SCENE_LINK:
      return 'scene-link';
  }
}

export function toMarkers(scene: TourGraphScene): SceneMarker[] {
  const markers: SceneMarker[] = [];

  for (const hotspot of scene.hotspots) {
    if (hotspot.type === HotspotType.SCENE_LINK) {
      continue;
    }

    const kind = hotspotKind(hotspot.type);
    if (kind === 'scene-link') {
      continue;
    }

    markers.push({
      id: hotspot.id,
      position: {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
      },
      kind,
      tooltip: hotspot.label,
      icon: hotspot.icon,
    });
  }

  return markers;
}
