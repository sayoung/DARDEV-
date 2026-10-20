import { describe, it, expect } from 'vitest';
import { computeSceneOrientation } from './orientation.js';
import type { TourGraphScene } from '@xplor/shared';
import type { VirtualTourLink } from '@photo-sphere-viewer/virtual-tour-plugin';

describe('computeSceneOrientation', () => {
  const mockScene: TourGraphScene = {
    id: 's1',
    title: 'Scène 1',
    caption: null,
    panorama: {
      preview: 'p1',
      web: 'w1',
      tiles: { width: 1024, cols: 2, rows: 1, baseUrl: 'b1' },
    },
    initialView: {
      yaw: 1.5,
      pitch: 0.5,
      zoom: 50,
    },
    narrationUrl: null,
    ambientUrl: null,
    thumb: 't1',
    hotspots: [],
  };

  it('uses arrivalYaw with pitch 0 if present in fromLink', () => {
    const link: VirtualTourLink = {
      nodeId: 's1',
      data: {
        arrivalYaw: 3.14,
      },
    };

    const result = computeSceneOrientation(mockScene, link);

    expect(result).toEqual({
      yaw: 3.14,
      pitch: 0,
    });
  });

  it('preserves arrivalYaw: 0 (falsy number) with pitch 0', () => {
    const link: VirtualTourLink = {
      nodeId: 's1',
      data: {
        arrivalYaw: 0,
      },
    };

    const result = computeSceneOrientation(mockScene, link);

    expect(result).toEqual({
      yaw: 0,
      pitch: 0,
    });
  });

  it('uses arrivalYaw in 2D mode when fromLink contains both arrivalYaw and label', () => {
    const link: VirtualTourLink = {
      nodeId: 's1',
      data: {
        arrivalYaw: 2.71,
        label: 'Direction chambre',
      },
    };

    const result = computeSceneOrientation(mockScene, link);

    expect(result).toEqual({
      yaw: 2.71,
      pitch: 0,
    });
  });

  it('uses scene initialView if arrivalYaw is null', () => {
    const link: VirtualTourLink = {
      nodeId: 's1',
      data: {
        arrivalYaw: null,
      },
    };

    const result = computeSceneOrientation(mockScene, link);

    expect(result).toEqual({
      yaw: 1.5,
      pitch: 0.5,
      zoom: 50,
    });
  });

  it('uses scene initialView if fromLink has no data', () => {
    const link: VirtualTourLink = {
      nodeId: 's1',
    };

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
