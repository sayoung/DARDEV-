import * as THREE from 'three';
import {
  HotspotType,
  type TourGraph,
  type TourGraphHotspot,
} from '@xplor/shared';
import { isVrSupported } from './vr-support.js';
import { mountVrButton } from './vr-button.js';
import { createVrRenderer } from './vr-renderer.js';
import { createVrScene } from './vr-scene.js';
import { createInfoPanel } from './vr-info-panel-mesh.js';
import { createGazeSelector } from './gaze-selector.js';
import { createVrFade } from './vr-fade.js';
import { createVrInteraction } from './vr-interaction.js';
import {
  createVrSession,
  type VrRendererLike,
  type VrSessionHandle,
  type XrSessionLike,
  type XrSystemLike,
} from './vr-session.js';
import { createVrPlayer, type VrPlayer } from './vr-player.js';
import { toVrTargets, withExitTarget } from './vr-targets.js';

/**
 * Options de configuration pour le montage VR WebXR (M6 F-70, F-71).
 */
export interface MountVrOptions {
  label: string;
  startFailedLabel?: string;
  graph: TourGraph;
  getCurrentSceneId: () => string;
  showScene: (id: string) => Promise<void>;
  resolveTextureUrl: (sceneId: string) => string | null;
  navigatorLike?: Parameters<typeof isVrSupported>[0];
}

/**
 * Handle de contrôle du mode VR.
 */
export interface MountVrHandle {
  destroy(): void;
}

type SceneDataResult = {
  kind: 'tour-link' | 'info';
  targetSceneId?: string;
  text?: string;
  rtl?: boolean;
} | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isXrSession(value: unknown): value is XRSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'addEventListener' in value &&
    'end' in value
  );
}

function hasXrRequestSession(value: unknown): value is {
  xr: XrSystemLike;
} {
  if (!isRecord(value) || !('xr' in value)) {
    return false;
  }
  const xr = value.xr;
  if (!isRecord(xr) || !('requestSession' in xr)) {
    return false;
  }
  return typeof xr.requestSession === 'function';
}

function getXrSystem(
  navLike?: Parameters<typeof isVrSupported>[0],
): XrSystemLike | null {
  const target: unknown =
    navLike !== undefined
      ? navLike
      : typeof globalThis !== 'undefined' && 'navigator' in globalThis
        ? globalThis.navigator
        : undefined;

  if (hasXrRequestSession(target)) {
    return target.xr;
  }
  return null;
}

function findHotspot(
  graph: TourGraph,
  currentSceneId: string,
  hotspotId: string,
): TourGraphHotspot | undefined {
  const currentScene = graph.scenes.find((s) => s.id === currentSceneId);
  const foundInCurrent = currentScene?.hotspots.find((h) => h.id === hotspotId);
  if (foundInCurrent !== undefined) {
    return foundInCurrent;
  }
  for (const scene of graph.scenes) {
    const found = scene.hotspots.find((h) => h.id === hotspotId);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function getSceneData(
  graph: TourGraph,
  getCurrentSceneId: () => string,
  hotspotId: string,
): SceneDataResult {
  const hotspot = findHotspot(graph, getCurrentSceneId(), hotspotId);
  if (hotspot === undefined) {
    return null;
  }
  if (hotspot.type === HotspotType.TOUR_LINK) {
    return {
      kind: 'tour-link',
      targetSceneId:
        typeof hotspot.targetSceneId === 'string'
          ? hotspot.targetSceneId
          : undefined,
    };
  }
  if (hotspot.type === HotspotType.INFO) {
    return {
      kind: 'info',
      text: hotspot.bodyHtml,
      rtl: graph.lang === 'ar',
    };
  }
  return null;
}

/**
 * Monte le contrôleur VR WebXR dans le conteneur hôte (M6 F-70, F-71).
 *
 * Assemble :
 * - `mountVrButton` avec détection conditionnelle `isVrSupported`
 * - Création paresseuse du renderer Three.js au clic
 * - Scène VR Three.js avec sphère équirectangulaire et marqueurs
 * - Panneau d'information 3D `createInfoPanel`
 * - Détecteur de regard fixe `createGazeSelector`
 * - Fondu au noir confort `createVrFade`
 * - Coordinateur d'interactions VR `createVrInteraction`
 * - Gestionnaire de session immersive `createVrSession`
 * - Lecteur de visite `createVrPlayer`
 *
 * @param container Conteneur hôte dans lequel le bouton VR puis le renderer sont insérés.
 * @param opts Configuration du graphe de visite, callbacks et détection.
 * @returns Handle avec méthode idempotente `destroy()`.
 */
export async function mountVr(
  container: HTMLElement,
  opts: MountVrOptions,
): Promise<MountVrHandle> {
  let currentSession: VrSessionHandle | null = null;
  let currentTeardown: (() => void) | null = null;
  let isStarting = false;
  let isDestroyed = false;
  let alertElement: HTMLDivElement | null = null;
  let alertTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const removeAlert = (): void => {
    if (alertTimeoutId !== null) {
      clearTimeout(alertTimeoutId);
      alertTimeoutId = null;
    }
    if (alertElement !== null) {
      if (alertElement.parentNode !== null) {
        alertElement.parentNode.removeChild(alertElement);
      }
      alertElement = null;
    }
  };

  const showAlert = (message: string): void => {
    removeAlert();
    if (isDestroyed) {
      return;
    }
    const doc = container.ownerDocument;
    const alertDiv = doc.createElement('div');
    alertDiv.setAttribute('role', 'alert');
    alertDiv.textContent = message;
    alertDiv.style.position = 'absolute';
    alertDiv.style.insetBlockStart = '1rem';
    alertDiv.style.insetInlineStart = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.paddingBlock = '0.5rem';
    alertDiv.style.paddingInline = '1rem';
    alertDiv.style.borderRadius = '0.5rem';
    alertDiv.style.backgroundColor = '#ba1a1a';
    alertDiv.style.color = '#ffffff';
    alertDiv.style.fontSize = '0.875rem';
    alertDiv.style.zIndex = '1000';
    alertDiv.style.pointerEvents = 'none';

    container.appendChild(alertDiv);
    alertElement = alertDiv;

    alertTimeoutId = setTimeout(() => {
      removeAlert();
    }, 4000);
  };

  const loadTextureForScene = async (
    sceneId: string,
  ): Promise<THREE.Texture | null> => {
    const url = opts.resolveTextureUrl(sceneId);
    if (url === null || url === '') {
      return null;
    }
    const loader = new THREE.TextureLoader();
    const texture = await loader.loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const handleClick = async (): Promise<void> => {
    if (isDestroyed || isStarting || (currentSession !== null && currentSession.isActive())) {
      return;
    }
    isStarting = true;

    try {
      // 1. Création paresseuse du renderer Three.js
      const rendererHandle = createVrRenderer(container);

      // 2. Création de la scène VR et du panneau d'information 3D
      const vrScene = createVrScene();
      const infoPanel = createInfoPanel();
      vrScene.scene.add(infoPanel.mesh);

      let isDisposed = false;
      const teardown = (): void => {
        if (isDisposed) {
          return;
        }
        isDisposed = true;
        infoPanel.dispose();
        vrScene.dispose();
        rendererHandle.dispose();
        if (currentTeardown === teardown) {
          currentTeardown = null;
        }
        currentSession = null;
      };
      currentTeardown = teardown;

      // 3. Détection de la scène courante et configuration des marqueurs avec cible de sortie VR
      const currentSceneId = opts.getCurrentSceneId();
      const currentScene =
        opts.graph.scenes.find((s) => s.id === currentSceneId) ??
        opts.graph.scenes[0];

      if (currentScene !== undefined) {
        vrScene.setMarkers(withExitTarget(toVrTargets(currentScene)));
      }

      // 4. Composants purs : sélecteur par regard, fondu confort, interactions
      const gaze = createGazeSelector();
      const fade = createVrFade();

      let player: VrPlayer | null = null;

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => vrScene.getMarkerTargets(),
        onNavigate: (hotspotId: string) => {
          if (player !== null) {
            player.handleNavigate(hotspotId);
          }
        },
      });

      const xrSystem = getXrSystem(opts.navigatorLike);
      if (xrSystem === null) {
        teardown();
        return;
      }

      // Boucle onFrame → player.frame(now) puis renderer.render. Aucune rotation automatique.
      const vrRendererAdapter: VrRendererLike = {
        xr: {
          get enabled(): boolean {
            return rendererHandle.renderer.xr.enabled;
          },
          set enabled(val: boolean) {
            rendererHandle.renderer.xr.enabled = val;
          },
          setSession: async (s: XrSessionLike): Promise<void> => {
            if (isXrSession(s)) {
              await rendererHandle.renderer.xr.setSession(s);
            }
          },
        },
        setAnimationLoop: (cb: ((time: number) => void) | null): void => {
          rendererHandle.renderer.setAnimationLoop(cb);
        },
      };

      const session = createVrSession({
        xr: xrSystem,
        renderer: vrRendererAdapter,
        onFrame: (time: number) => {
          if (player !== null) {
            player.frame(time);
          }
          rendererHandle.render(vrScene.scene);
        },
        onEnd: () => {
          teardown();
        },
      });
      currentSession = session;

      // À la fin de session (exit) : dispose du renderer et de la scène VR
      const originalExit = session.exit.bind(session);
      session.exit = async (): Promise<void> => {
        try {
          await originalExit();
        } finally {
          teardown();
        }
      };

      player = createVrPlayer({
        session,
        scene: vrScene,
        interaction,
        panel: infoPanel,
        getGazeDir: () => rendererHandle.getGazeDir(),
        loadTexture: loadTextureForScene,
        getSceneData: (hotspotId: string) =>
          getSceneData(opts.graph, opts.getCurrentSceneId, hotspotId),
        showScene: async (targetSceneId: string) => {
          await opts.showScene(targetSceneId);
          const nextScene = opts.graph.scenes.find((s) => s.id === targetSceneId);
          if (nextScene !== undefined) {
            vrScene.setMarkers(withExitTarget(toVrTargets(nextScene)));
          }
        },
      });

      // 5. Entrée en session immersive synchrone dans le geste du clic avant tout await
      const entered = session.enter({ optionalFeatures: ['local-floor'] });
      entered.catch(() => {});

      // 6. Ensuite seulement : chargement de la texture (fond noir pendant le chargement)
      if (currentScene !== undefined) {
        try {
          const initialTexture = await loadTextureForScene(currentScene.id);
          vrScene.setTexture(initialTexture);
        } catch (error) {
          console.error(error);
        }
      }

      await entered;
    } catch (error) {
      if (currentTeardown !== null) {
        currentTeardown();
        currentTeardown = null;
      }
      throw error;
    } finally {
      isStarting = false;
    }
  };

  const buttonHandle = await mountVrButton(container, {
    label: opts.label,
    supported: () => isVrSupported(opts.navigatorLike),
    onClick: () => {
      handleClick().catch((error: unknown) => {
        if (currentTeardown !== null) {
          currentTeardown();
          currentTeardown = null;
        }
        console.error(error);
        showAlert(opts.startFailedLabel ?? "La VR n'a pas pu démarrer");
      });
    },
  });

  return {
    destroy: () => {
      if (isDestroyed) {
        return;
      }
      isDestroyed = true;
      removeAlert();
      buttonHandle.destroy();
      if (currentSession !== null && currentSession.isActive()) {
        void currentSession.exit();
      }
      if (currentTeardown !== null) {
        currentTeardown();
        currentTeardown = null;
      }
    },
  };
}
