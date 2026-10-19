import { describe, expect, it, vi } from 'vitest';
import {
  createVrPlayer,
  type VrPlayerDeps,
} from './vr-player.js';
import { createVrPlayer as createVrPlayerFromIndex } from '../index.js';
import { VR_EXIT_TARGET_ID } from './vr-targets.js';
import type { VrInteractionFrameResult } from './vr-interaction.js';

function createFakeDeps(overrides?: {
  gazeDir?: { yaw: number; pitch: number } | null;
  frameResult?: VrInteractionFrameResult;
  onExit?: () => Promise<void>;
}): {
  deps: VrPlayerDeps;
  exitSpy: () => Promise<void>;
  frameSpy: (gazeDir: { yaw: number; pitch: number } | null, nowMs: number) => VrInteractionFrameResult;
} {
  const exitFn = overrides?.onExit ?? (() => Promise.resolve());
  const exitSpy = vi.fn(exitFn);

  const defaultResult: VrInteractionFrameResult = {
    progress: 0.65,
    fadeOpacity: 0.1,
    hoveredId: 'spot-oudaias',
  };
  const expectedFrameResult = overrides?.frameResult ?? defaultResult;

  const frameSpy = vi.fn((): VrInteractionFrameResult => {
    return expectedFrameResult;
  });

  const currentGazeDir: { yaw: number; pitch: number } | null =
    overrides !== undefined && overrides.gazeDir !== undefined
      ? overrides.gazeDir
      : { yaw: 0.75, pitch: -0.25 };

  const deps: VrPlayerDeps = {
    session: {
      enter: () => Promise.resolve(),
      exit: exitSpy,
      isActive: () => true,
    },
    scene: {
      setMarkers: () => {},
      setTexture: () => {},
      getMarkerTargets: () => [],
    },
    interaction: {
      frame: frameSpy,
      selectNow: () => {},
      reset: () => {},
    },
    panel: {
      show: () => {},
      hide: () => {},
    },
    getGazeDir: () => currentGazeDir,
    loadTexture: () => Promise.resolve({}),
    getSceneData: () => null,
    showScene: () => Promise.resolve(),
  };

  return {
    deps,
    exitSpy,
    frameSpy,
  };
}

describe('vr-player (M6 F-71)', () => {
  it('est exporté depuis index.ts', () => {
    expect(createVrPlayerFromIndex).toBe(createVrPlayer);
  });

  describe('frame', () => {
    it('frame délègue avec le regard et renvoie le résultat', () => {
      const gaze = { yaw: 1.15, pitch: -0.42 };
      const expectedResult: VrInteractionFrameResult = {
        progress: 0.8,
        fadeOpacity: 0.35,
        hoveredId: 'spot-chella',
      };

      const { deps, frameSpy } = createFakeDeps({
        gazeDir: gaze,
        frameResult: expectedResult,
      });

      const player = createVrPlayer(deps);
      const result = player.frame(2500);

      expect(frameSpy).toHaveBeenCalledTimes(1);
      expect(frameSpy).toHaveBeenCalledWith(gaze, 2500);
      expect(result).toEqual(expectedResult);
    });

    it('frame avec getGazeDir null', () => {
      const nullFrameResult: VrInteractionFrameResult = {
        progress: 0,
        fadeOpacity: 0,
        hoveredId: null,
      };

      const { deps, frameSpy } = createFakeDeps({
        gazeDir: null,
        frameResult: nullFrameResult,
      });

      const player = createVrPlayer(deps);
      const result = player.frame(1000);

      expect(frameSpy).toHaveBeenCalledTimes(1);
      expect(frameSpy).toHaveBeenCalledWith(null, 1000);
      expect(result).toEqual(nullFrameResult);
    });

    it('délègue consécutivement les frames avec des horodatages distincts', () => {
      const expectedResult: VrInteractionFrameResult = {
        progress: 0.5,
        fadeOpacity: 0,
        hoveredId: 'spot-1',
      };

      const { deps, frameSpy } = createFakeDeps({
        gazeDir: { yaw: 0, pitch: 0 },
        frameResult: expectedResult,
      });

      const player = createVrPlayer(deps);

      player.frame(100);
      player.frame(200);
      player.frame(300);

      expect(frameSpy).toHaveBeenCalledTimes(3);
      expect(frameSpy).toHaveBeenNthCalledWith(1, { yaw: 0, pitch: 0 }, 100);
      expect(frameSpy).toHaveBeenNthCalledWith(2, { yaw: 0, pitch: 0 }, 200);
      expect(frameSpy).toHaveBeenNthCalledWith(3, { yaw: 0, pitch: 0 }, 300);
    });
  });

  describe('handleNavigate', () => {
    it('handleNavigate(VR_EXIT_TARGET_ID) appelle session.exit une fois', () => {
      const { deps, exitSpy } = createFakeDeps();
      const player = createVrPlayer(deps);

      expect(exitSpy).not.toHaveBeenCalled();

      player.handleNavigate(VR_EXIT_TARGET_ID);

      expect(exitSpy).toHaveBeenCalledTimes(1);
    });

    it("un autre id n'appelle pas exit", () => {
      const { deps, exitSpy } = createFakeDeps();
      const player = createVrPlayer(deps);

      player.handleNavigate('hotspot-autre-scene');
      player.handleNavigate('tour-link-jardin');
      player.handleNavigate('info-panneau');

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("un id vide ou invalide n'appelle pas exit", () => {
      const { deps, exitSpy } = createFakeDeps();
      const player = createVrPlayer(deps);

      player.handleNavigate('');
      player.handleNavigate('   ');

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('appelle session.exit à chaque sélection de VR_EXIT_TARGET_ID', () => {
      const { deps, exitSpy } = createFakeDeps();
      const player = createVrPlayer(deps);

      player.handleNavigate(VR_EXIT_TARGET_ID);
      player.handleNavigate(VR_EXIT_TARGET_ID);

      expect(exitSpy).toHaveBeenCalledTimes(2);
    });
  });
});
