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

export function toMarkers(scene: TourGraphScene): SceneMarker[] {
  const markers: SceneMarker[] = [];

  for (const hotspot of scene.hotspots) {
    if (hotspot.type === HotspotType.SCENE_LINK) {
      continue;
    }

    let kind: SceneMarker['kind'];
    switch (hotspot.type) {
      case HotspotType.TOUR_LINK:
        kind = 'tour-link';
        break;
      case HotspotType.INFO:
        kind = 'info';
        break;
      case HotspotType.MEDIA:
        kind = 'media';
        break;
      case HotspotType.URL:
        kind = 'url';
        break;
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
