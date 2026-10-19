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
  onLoadTexture?: (sceneId: string) => Promise<unknown>;
  onShowScene?: (sceneId: string) => Promise<void>;
  getSceneData?: (hotspotId: string) => {
    kind: 'tour-link' | 'info';
    targetSceneId?: string;
    text?: string;
    rtl?: boolean;
  } | null;
  onSetTexture?: (tex: unknown) => void;
  onPanelShow?: (lines: string[], rtl?: boolean) => void;
  onPanelHide?: () => void;
}): {
  deps: VrPlayerDeps;
  exitSpy: ReturnType<typeof vi.fn<() => Promise<void>>>;
  frameSpy: ReturnType<typeof vi.fn<(gazeDir: { yaw: number; pitch: number } | null, nowMs: number) => VrInteractionFrameResult>>;
  loadTextureSpy: ReturnType<typeof vi.fn<(sceneId: string) => Promise<unknown>>>;
  showSceneSpy: ReturnType<typeof vi.fn<(sceneId: string) => Promise<void>>>;
  getSceneDataSpy: ReturnType<typeof vi.fn<(hotspotId: string) => { kind: 'tour-link' | 'info'; targetSceneId?: string; text?: string; rtl?: boolean } | null>>;
  setTextureSpy: ReturnType<typeof vi.fn<(tex: unknown) => void>>;
  panelShowSpy: ReturnType<typeof vi.fn<(lines: string[], rtl?: boolean) => void>>;
  panelHideSpy: ReturnType<typeof vi.fn<() => void>>;
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

  const loadTextureSpy = vi.fn(
    overrides?.onLoadTexture ?? ((sceneId: string) => Promise.resolve({ id: sceneId }))
  );
  const showSceneSpy = vi.fn(
    overrides?.onShowScene ?? (() => Promise.resolve())
  );
  const getSceneDataSpy = vi.fn(
    overrides?.getSceneData ?? (() => null)
  );
  const setTextureSpy = vi.fn(
    overrides?.onSetTexture ?? (() => {})
  );
  const panelShowSpy = vi.fn(
    overrides?.onPanelShow ?? (() => {})
  );
  const panelHideSpy = vi.fn(
    overrides?.onPanelHide ?? (() => {})
  );

  const deps: VrPlayerDeps = {
    session: {
      enter: () => Promise.resolve(),
      exit: exitSpy,
      isActive: () => true,
    },
    scene: {
      setMarkers: () => {},
      setTexture: setTextureSpy,
      getMarkerTargets: () => [],
    },
    interaction: {
      frame: frameSpy,
      selectNow: () => {},
      reset: () => {},
    },
    panel: {
      show: panelShowSpy,
      hide: panelHideSpy,
    },
    getGazeDir: () => currentGazeDir,
    loadTexture: loadTextureSpy,
    getSceneData: getSceneDataSpy,
    showScene: showSceneSpy,
  };

  return {
    deps,
    exitSpy,
    frameSpy,
    loadTextureSpy,
    showSceneSpy,
    getSceneDataSpy,
    setTextureSpy,
    panelShowSpy,
    panelHideSpy,
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

    it('navigation tour-link (ordre loadTexture → setTexture → showScene)', async () => {
      const callOrder: string[] = [];
      const fakeTexture = { isTexture: true };

      const { deps, loadTextureSpy, setTextureSpy, showSceneSpy, panelHideSpy } = createFakeDeps({
        getSceneData: (id) =>
          id === 'spot-cour'
            ? { kind: 'tour-link', targetSceneId: 'scene-jardin' }
            : null,
        onLoadTexture: (sceneId) => {
          callOrder.push(`loadTexture:${sceneId}`);
          return Promise.resolve(fakeTexture);
        },
        onSetTexture: (tex) => {
          callOrder.push(`setTexture:${tex === fakeTexture ? 'match' : 'mismatch'}`);
        },
        onShowScene: (sceneId) => {
          callOrder.push(`showScene:${sceneId}`);
          return Promise.resolve();
        },
      });

      const player = createVrPlayer(deps);
      player.handleNavigate('spot-cour');

      await vi.waitFor(() => {
        expect(showSceneSpy).toHaveBeenCalledWith('scene-jardin');
      });

      expect(panelHideSpy).toHaveBeenCalledTimes(1);
      expect(loadTextureSpy).toHaveBeenCalledTimes(1);
      expect(loadTextureSpy).toHaveBeenCalledWith('scene-jardin');
      expect(setTextureSpy).toHaveBeenCalledTimes(1);
      expect(setTextureSpy).toHaveBeenCalledWith(fakeTexture);
      expect(showSceneSpy).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual([
        'loadTexture:scene-jardin',
        'setTexture:match',
        'showScene:scene-jardin',
      ]);
    });

    it('info (lignes enveloppées, rtl transmis)', () => {
      const { deps, panelShowSpy, panelHideSpy, loadTextureSpy, showSceneSpy } = createFakeDeps({
        getSceneData: (id) =>
          id === 'spot-info-ar'
            ? {
                kind: 'info',
                text: '<p>مرحبا بكم في قصبة الوداية التاريخية المشرفة على وادي أبي رقراق والمحيط الأطلسي</p>',
                rtl: true,
              }
            : null,
      });

      const player = createVrPlayer(deps);
      player.handleNavigate('spot-info-ar');

      expect(panelHideSpy).toHaveBeenCalledTimes(1);
      expect(panelShowSpy).toHaveBeenCalledTimes(1);

      const firstCall = panelShowSpy.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall !== undefined) {
        const [lines, rtl] = firstCall;
        expect(rtl).toBe(true);
        expect(Array.isArray(lines)).toBe(true);
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.length).toBeLessThanOrEqual(8);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(40);
        }
      }

      expect(loadTextureSpy).not.toHaveBeenCalled();
      expect(showSceneSpy).not.toHaveBeenCalled();
    });

    it('info avec html nettoyé et rtl optionnel', () => {
      const { deps, panelShowSpy } = createFakeDeps({
        getSceneData: (id) =>
          id === 'spot-info-fr'
            ? {
                kind: 'info',
                text: '<h1>Palais</h1><p>Construit au <b>XVIIe siècle</b>.<br/>Vue panoramique.</p>',
                rtl: false,
              }
            : null,
      });

      const player = createVrPlayer(deps);
      player.handleNavigate('spot-info-fr');

      expect(panelShowSpy).toHaveBeenCalledTimes(1);
      const firstCall = panelShowSpy.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall !== undefined) {
        const [lines, rtl] = firstCall;
        expect(rtl).toBe(false);
        const joined = lines.join(' ');
        expect(joined).toContain('Palais');
        expect(joined).toContain('XVIIe siècle');
        expect(joined).not.toContain('<p>');
        expect(joined).not.toContain('<br/>');
      }
    });

    it('sortie (VR_EXIT_TARGET_ID → exit, pas de loadTexture)', () => {
      const {
        deps,
        exitSpy,
        loadTextureSpy,
        showSceneSpy,
        panelHideSpy,
        getSceneDataSpy,
      } = createFakeDeps();
      const player = createVrPlayer(deps);

      player.handleNavigate(VR_EXIT_TARGET_ID);

      expect(panelHideSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledTimes(1);
      expect(loadTextureSpy).not.toHaveBeenCalled();
      expect(showSceneSpy).not.toHaveBeenCalled();
      expect(getSceneDataSpy).not.toHaveBeenCalled();
    });

    it('erreur de texture (loadTexture rejette : pas d exception, showScene non appelé, setTexture non appelé)', async () => {
      const { deps, loadTextureSpy, setTextureSpy, showSceneSpy, panelHideSpy } = createFakeDeps({
        getSceneData: (id) =>
          id === 'spot-fail'
            ? { kind: 'tour-link', targetSceneId: 'scene-invalide' }
            : null,
        onLoadTexture: () => Promise.reject(new Error('Texture 404 introuvable')),
      });

      const player = createVrPlayer(deps);

      expect(() => {
        player.handleNavigate('spot-fail');
      }).not.toThrow();

      await vi.waitFor(() => {
        expect(loadTextureSpy).toHaveBeenCalledWith('scene-invalide');
      });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });

      expect(panelHideSpy).toHaveBeenCalledTimes(1);
      expect(setTextureSpy).not.toHaveBeenCalled();
      expect(showSceneSpy).not.toHaveBeenCalled();
    });

    it('nouveau handleNavigate masque le panneau', () => {
      const { deps, panelHideSpy, panelShowSpy } = createFakeDeps({
        getSceneData: (id) => {
          if (id === 'spot-info') {
            return { kind: 'info', text: 'Description du monument' };
          }
          return null;
        },
      });

      const player = createVrPlayer(deps);

      player.handleNavigate('spot-info');
      expect(panelHideSpy).toHaveBeenCalledTimes(1);
      expect(panelShowSpy).toHaveBeenCalledTimes(1);

      panelHideSpy.mockClear();

      player.handleNavigate('spot-autre');
      expect(panelHideSpy).toHaveBeenCalledTimes(1);

      panelHideSpy.mockClear();

      player.handleNavigate(VR_EXIT_TARGET_ID);
      expect(panelHideSpy).toHaveBeenCalledTimes(1);
    });

    it('getSceneData null ignoré', () => {
      const {
        deps,
        panelHideSpy,
        panelShowSpy,
        loadTextureSpy,
        setTextureSpy,
        showSceneSpy,
        exitSpy,
      } = createFakeDeps({
        getSceneData: () => null,
      });

      const player = createVrPlayer(deps);

      player.handleNavigate('spot-inconnu');

      expect(panelHideSpy).toHaveBeenCalledTimes(1);
      expect(panelShowSpy).not.toHaveBeenCalled();
      expect(loadTextureSpy).not.toHaveBeenCalled();
      expect(setTextureSpy).not.toHaveBeenCalled();
      expect(showSceneSpy).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('tour-link sans targetSceneId est ignoré', () => {
      const { deps, panelHideSpy, loadTextureSpy, showSceneSpy, setTextureSpy } = createFakeDeps({
        getSceneData: () => ({ kind: 'tour-link', targetSceneId: undefined }),
      });

      const player = createVrPlayer(deps);
      player.handleNavigate('spot-sans-cible');

      expect(panelHideSpy).toHaveBeenCalledTimes(1);
      expect(loadTextureSpy).not.toHaveBeenCalled();
      expect(setTextureSpy).not.toHaveBeenCalled();
      expect(showSceneSpy).not.toHaveBeenCalled();
    });
  });
});
