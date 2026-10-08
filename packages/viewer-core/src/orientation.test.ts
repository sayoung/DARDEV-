import { describe, it, expect } from 'vitest';
import { computeSceneOrientation } from './orientation.js';
import type { TourGraphScene } from '@xplor/shared';
import type { VirtualTourLink } from '@photo-sphere-viewer/virtual-tour-plugin';

describe('computeSceneOrientation', () => {
  const mockScene = {
    id: 's1',
    initialView: {
      yaw: 1.5,
      pitch: 0.5,
      zoom: 50,
    },
  } as TourGraphScene;

  it('uses arrivalYaw with pitch 0 if present in fromLink', () => {
    const link = {
      nodeId: 's1',
      data: {
        arrivalYaw: 3.14,
      },
    } as VirtualTourLink;

    const result = computeSceneOrientation(mockScene, link);

    expect(result).toEqual({
      yaw: 3.14,
      pitch: 0,
    });
  });

  it('uses scene initialView if arrivalYaw is null', () => {
    const link = {
      nodeId: 's1',
      data: {
        arrivalYaw: null,
      },
    } as VirtualTourLink;

    const result = computeSceneOrientation(mockScene, link);

    expect(result).toEqual({
      yaw: 1.5,
      pitch: 0.5,
      zoom: 50,
    });
  });

  it('uses scene initialView if fromLink has no data', () => {
    const link = {
      nodeId: 's1',
    } as VirtualTourLink;

    const result = computeSceneOrientation(mockScene, link);

    expect(result).toEqual({
      yaw: 1.5,
      pitch: 0.5,
      zoom: 50,
    });
  });

  it('uses scene initialView if fromLink is undefined', () => {
    const result = computeSceneOrientation(mockScene);

    expect(result).toEqual({
      yaw: 1.5,
      pitch: 0.5,
      zoom: 50,
    });
  });
});
