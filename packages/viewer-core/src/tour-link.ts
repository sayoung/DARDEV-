import { HotspotType, TourGraph } from '@xplor/shared';

export function resolveTourLink(
  graph: TourGraph,
  hotspotId: string
): {
  shareToken: string;
  sceneId: string | null;
  arrivalYaw: number | null;
  title: string;
} | null {
  for (const scene of graph.scenes) {
    for (const hotspot of scene.hotspots) {
      if (hotspot.id === hotspotId) {
        if (hotspot.type !== HotspotType.TOUR_LINK) {
          return null;
        }

        const linkedTour = graph.linkedTours.find(
          (tour) => tour.id === hotspot.targetTourId
        );

        if (!linkedTour || !linkedTour.shareToken) {
          return null;
        }

        return {
          shareToken: linkedTour.shareToken,
          sceneId: hotspot.targetSceneId ?? null,
          arrivalYaw: hotspot.arrivalYaw ?? null,
          title: linkedTour.title,
        };
      }
    }
  }

  return null;
}
