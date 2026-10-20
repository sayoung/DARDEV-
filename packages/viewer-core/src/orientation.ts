import type { TourGraphScene } from '@xplor/shared';
import type { VirtualTourLink } from '@photo-sphere-viewer/virtual-tour-plugin';

export type OrientationCommand = {
  yaw: number;
  pitch: number;
  zoom?: number;
};

export function computeSceneOrientation(
  scene: TourGraphScene,
  fromLink?: VirtualTourLink | null
): OrientationCommand {
  // Check if we arrived via a link that has an arrivalYaw
  const arrivalYaw = fromLink?.data && typeof (fromLink.data as Record<string, unknown>).arrivalYaw === 'number' 
    ? (fromLink.data as Record<string, unknown>).arrivalYaw as number 
    : null;

  if (arrivalYaw !== null) {
    return {
      yaw: arrivalYaw,
      pitch: 0,
      // No zoom specified for arrival via link (viewer keeps current zoom or resets, 
      // but according to instruction "sinon utilise initialView de la scène").
      // So zoom is not set when using arrivalYaw.
    };
  }

  // Fallback to the scene's initialView
  return {
    yaw: scene.initialView.yaw,
    pitch: scene.initialView.pitch,
    zoom: scene.initialView.zoom,
  };
}
