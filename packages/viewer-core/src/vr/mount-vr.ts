import * as THREE from 'three';
import {
  HotspotType,
  type TourGraph,
  type TourGraphHotspot,
} from '@xplor/shared';
import {
  pickHotspot,
  vectorToSpherical,
  type SphericalPosition,
} from './vr-geometry.js';
import { isVrSupported } from './vr-support.js';
import { mountVrButton } from './vr-button.js';
import { createVrRenderer } from './vr-renderer.js';
import { createVrScene, type VrMarkerTarget } from './vr-scene.js';
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
import { createVrPlayer, type VrPlayer, type VrPlayerSceneData } from './vr-player.js';
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
  openTourLink?: (hotspotId: string) => void | Promise<void>;
}

/**
 * Handle de contrôle du mode VR.
 */
export interface MountVrHandle {
  destroy(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isThreeObject(value: unknown): value is THREE.Object3D {
  return value instanceof THREE.Object3D;
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
): VrPlayerSceneData | null {
  const hotspot = findHotspot(graph, getCurrentSceneId(), hotspotId);
  if (hotspot === undefined) {
    return null;
  }
  if (hotspot.type === HotspotType.SCENE_LINK) {
    return {
      kind: 'scene-link',
      targetSceneId: hotspot.targetSceneId,
      arrivalYaw:
        typeof hotspot.arrivalYaw === 'number'
          ? hotspot.arrivalYaw
          : undefined,
    };
  }
  if (hotspot.type === HotspotType.TOUR_LINK) {
    return {
      kind: 'tour-link',
      hotspotId: hotspot.id,
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

interface XrSessionInputsLike {
  inputSources?: readonly unknown[];
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

interface RendererWithXrControllers {
  xr: {
    getController(index: number): unknown;
  };
}

function isRendererWithXrControllers(
  value: unknown,
): value is RendererWithXrControllers {
  if (!isRecord(value) || !isRecord(value.xr)) {
    return false;
  }
  return typeof value.xr.getController === 'function';
}

function isControllerTargetRay(
  value: unknown,
): value is ReturnType<THREE.WebGLRenderer['xr']['getController']> {
  return value instanceof THREE.Object3D;
}

function isXrSessionInputsLike(value: unknown): value is XrSessionInputsLike {
  return (
    isRecord(value) &&
    typeof value.addEventListener === 'function' &&
    typeof value.removeEventListener === 'function'
  );
}

function resolveDirectionFromController(
  controller: THREE.Object3D,
): SphericalPosition | null {
  const dir = new THREE.Vector3(0, 0, -1);
  const quat = new THREE.Quaternion();
  controller.getWorldQuaternion(quat);
  dir.applyQuaternion(quat);
  if (dir.lengthSq() === 0) {
    return null;
  }
  return vectorToSpherical(dir);
}

function resolveDirectionFromPose(pose: unknown): SphericalPosition | null {
  if (!isRecord(pose) || !isRecord(pose.transform)) {
    return null;
  }
  const orientation = pose.transform.orientation;
  if (!isRecord(orientation)) {
    return null;
  }
  const { x, y, z, w } = orientation;
  if (
    typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof y === 'number' &&
    Number.isFinite(y) &&
    typeof z === 'number' &&
    Number.isFinite(z) &&
    typeof w === 'number' &&
    Number.isFinite(w)
  ) {
    const dir = new THREE.Vector3(0, 0, -1);
    const quat = new THREE.Quaternion(x, y, z, w);
    dir.applyQuaternion(quat);
    if (dir.lengthSq() === 0) {
      return null;
    }
    return vectorToSpherical(dir);
  }
  return null;
}

interface XrInputTracker {
  bindSession(session: unknown): void;
  dispose(): void;
}

interface CreateXrInputTrackerOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  getTargets: () => VrMarkerTarget[];
  onSelectHotspot: (hotspotId: string, customTime?: number) => void;
}

function createRayLine(): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -8),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'xplor-vr-ray';
  return line;
}

function disposeRayLine(ray: THREE.Line): void {
  if (ray.parent !== null) {
    ray.parent.remove(ray);
  }
  ray.geometry.dispose();
  if (Array.isArray(ray.material)) {
    for (const mat of ray.material) {
      mat.dispose();
    }
  } else {
    ray.material.dispose();
  }
}

type XrTargetRay = ReturnType<THREE.WebGLRenderer['xr']['getController']>;

interface TrackedController {
  controller: XrTargetRay;
  ray: THREE.Line;
  removeListeners: () => void;
}

function createXrInputTracker(
  opts: CreateXrInputTrackerOptions,
): XrInputTracker {
  let isDisposed = false;
  const trackedControllers: TrackedController[] = [];
  const inputSourceToController = new Map<unknown, XrTargetRay>();
  let activeSession: XrSessionInputsLike | null = null;
  let sessionSelectListener: ((ev: unknown) => void) | null = null;
  let sessionEndListener: (() => void) | null = null;
  let sessionInputsListener: ((ev: unknown) => void) | null = null;

  function handleSelect(
    controller: THREE.Object3D | null,
    sourceOrEvent: unknown,
  ): void {
    if (isDisposed) {
      return;
    }

    let dir: SphericalPosition | null = null;

    if (controller !== null) {
      dir = resolveDirectionFromController(controller);
    }

    if (dir === null && isRecord(sourceOrEvent)) {
      if ('pose' in sourceOrEvent) {
        dir = resolveDirectionFromPose(sourceOrEvent.pose);
      }
    }

    if (dir === null) {
      return;
    }

    const targets = opts.getTargets();
    const hitId = pickHotspot(dir, targets);
    if (hitId !== null) {
      let customTime: number | undefined = undefined;
      if (
        isRecord(sourceOrEvent) &&
        typeof sourceOrEvent.timeStamp === 'number' &&
        Number.isFinite(sourceOrEvent.timeStamp)
      ) {
        customTime = sourceOrEvent.timeStamp;
      }
      opts.onSelectHotspot(hitId, customTime);
    }
  }

  // Contrôleurs Three.js depuis renderer.xr
  if (isRendererWithXrControllers(opts.renderer)) {
    for (let i = 0; i < 2; i++) {
      const candidate: unknown = opts.renderer.xr.getController(i);
      if (isControllerTargetRay(candidate)) {
        const ray = createRayLine();
        candidate.add(ray);
        opts.scene.add(candidate);

        const onCtrlSelect = (e: unknown): void => {
          handleSelect(candidate, e);
        };
        candidate.addEventListener('select', onCtrlSelect);

        const onConnected = (e: unknown): void => {
          if (isRecord(e) && 'data' in e && isRecord(e.data)) {
            inputSourceToController.set(e.data, candidate);
          }
        };
        candidate.addEventListener('connected', onConnected);

        const onDisconnected = (e: unknown): void => {
          if (isRecord(e) && 'data' in e && isRecord(e.data)) {
            inputSourceToController.delete(e.data);
          }
        };
        candidate.addEventListener('disconnected', onDisconnected);

        trackedControllers.push({
          controller: candidate,
          ray,
          removeListeners: () => {
            candidate.removeEventListener('select', onCtrlSelect);
            candidate.removeEventListener('connected', onConnected);
            candidate.removeEventListener('disconnected', onDisconnected);
          },
        });
      }
    }
  }

  function bindSession(session: unknown): void {
    if (isDisposed || !isXrSessionInputsLike(session)) {
      return;
    }
    activeSession = session;

    const onSessionSelect = (e: unknown): void => {
      let matchedController: THREE.Object3D | null = null;

      if (isRecord(e) && 'inputSource' in e && isRecord(e.inputSource)) {
        const inputSource = e.inputSource;
        const mapped = inputSourceToController.get(inputSource);
        if (mapped !== undefined) {
          matchedController = mapped;
        } else if (Array.isArray(session.inputSources)) {
          const index = session.inputSources.indexOf(inputSource);
          if (index >= 0 && index < trackedControllers.length) {
            const entry = trackedControllers[index];
            if (entry !== undefined) {
              matchedController = entry.controller;
            }
          }
        }
      }

      if (matchedController === null && isRecord(e) && isThreeObject(e.target)) {
        matchedController = e.target;
      }

      if (matchedController === null && trackedControllers.length > 0) {
        const first = trackedControllers[0];
        if (first !== undefined) {
          matchedController = first.controller;
        }
      }

      handleSelect(matchedController, e);
    };
    sessionSelectListener = onSessionSelect;
    session.addEventListener('select', onSessionSelect);

    const onSessionEnd = (): void => {
      dispose();
    };
    sessionEndListener = onSessionEnd;
    session.addEventListener('end', onSessionEnd);

    const onSessionInputs = (e: unknown): void => {
      if (isRecord(e) && Array.isArray(e.added)) {
        const addedList: readonly unknown[] = e.added;
        for (let i = 0; i < addedList.length; i++) {
          const src: unknown = addedList[i];
          if (isRecord(src) && i < trackedControllers.length) {
            const entry = trackedControllers[i];
            if (entry !== undefined) {
              inputSourceToController.set(src, entry.controller);
            }
          }
        }
      }
    };
    sessionInputsListener = onSessionInputs;
    session.addEventListener('inputsourceschange', onSessionInputs);

    if (Array.isArray(session.inputSources)) {
      const sources: readonly unknown[] = session.inputSources;
      for (let i = 0; i < sources.length; i++) {
        const src: unknown = sources[i];
        if (isRecord(src) && i < trackedControllers.length) {
          const entry = trackedControllers[i];
          if (entry !== undefined) {
            inputSourceToController.set(src, entry.controller);
          }
        }
      }
    }
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;

    if (activeSession !== null) {
      if (sessionSelectListener !== null) {
        activeSession.removeEventListener('select', sessionSelectListener);
      }
      if (sessionEndListener !== null) {
        activeSession.removeEventListener('end', sessionEndListener);
      }
      if (sessionInputsListener !== null) {
        activeSession.removeEventListener(
          'inputsourceschange',
          sessionInputsListener,
        );
      }
    }
    activeSession = null;
    sessionSelectListener = null;
    sessionEndListener = null;
    sessionInputsListener = null;

    for (const item of trackedControllers) {
      item.removeListeners();
      item.controller.remove(item.ray);
      disposeRayLine(item.ray);
      if (item.controller.parent !== null) {
        item.controller.parent.remove(item.controller);
      }
    }
    trackedControllers.length = 0;
    inputSourceToController.clear();
  }

  return {
    bindSession,
    dispose,
  };
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
 * - Suivi des sources et visée manette/main `createXrInputTracker` (M6 F-71)
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

      // 3. Détection de la scène courante et configuration des marqueurs avec cible de sortie VR
      const currentSceneId = opts.getCurrentSceneId();
      const currentScene =
        opts.graph.scenes.find((s) => s.id === currentSceneId) ??
        opts.graph.scenes[0];

      if (currentScene !== undefined) {
        vrScene.setMarkers(withExitTarget(toVrTargets(currentScene, opts.graph)));
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

      let currentFrameTime = 0;

      // 5. Suivi des manettes et mains XR avec rayon visible (M6 F-71)
      const xrInputTracker = createXrInputTracker({
        renderer: rendererHandle.renderer,
        scene: vrScene.scene,
        getTargets: () => vrScene.getMarkerTargets(),
        onSelectHotspot: (hotspotId: string, customTime?: number) => {
          const timeToUse =
            typeof customTime === 'number' && Number.isFinite(customTime)
              ? customTime
              : currentFrameTime;
          interaction.selectNow(hotspotId, timeToUse);
        },
      });

      let isDisposed = false;
      const teardown = (): void => {
        if (isDisposed) {
          return;
        }
        isDisposed = true;
        xrInputTracker.dispose();
        infoPanel.dispose();
        vrScene.dispose();
        rendererHandle.dispose();
        if (currentTeardown === teardown) {
          currentTeardown = null;
        }
        currentSession = null;
      };
      currentTeardown = teardown;

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
            xrInputTracker.bindSession(s);
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
          currentFrameTime = time;
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
            vrScene.setMarkers(withExitTarget(toVrTargets(nextScene, opts.graph)));
          }
        },
        openTourLink: opts.openTourLink,
      });

      // 6. Entrée en session immersive synchrone dans le geste du clic avant tout await
      const entered = session.enter({ optionalFeatures: ['local-floor'] });
      entered.catch(() => {});

      // 7. Ensuite seulement : chargement de la texture (fond noir pendant le chargement)
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
