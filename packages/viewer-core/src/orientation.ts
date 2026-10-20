import { z } from '@xplor/shared';
import type { TourGraphScene } from '@xplor/shared';
import type { VirtualTourLink } from '@photo-sphere-viewer/virtual-tour-plugin';

export type OrientationCommand = {
  yaw: number;
  pitch: number;
  zoom?: number;
};

const LinkArrivalDataSchema = z.looseObject({
  arrivalYaw: z.number().nullable().optional(),
});

function extractArrivalYaw(link?: VirtualTourLink | null): number | null {
  const parsed = LinkArrivalDataSchema.safeParse(link?.data);
  if (parsed.success && typeof parsed.data.arrivalYaw === 'number') {
    return parsed.data.arrivalYaw;
  }
  return null;
}

export function computeSceneOrientation(
  scene: TourGraphScene,
  fromLink?: VirtualTourLink | null
): OrientationCommand {
  const arrivalYaw = extractArrivalYaw(fromLink);

  if (arrivalYaw !== null) {
    return {
      yaw: arrivalYaw,
      pitch: 0,
    };
  }

  // Fallback to the scene's initialView
  return {
    yaw: scene.initialView.yaw,
    pitch: scene.initialView.pitch,
    zoom: scene.initialView.zoom,
  };
}
