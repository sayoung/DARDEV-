import type * as THREE from 'three';
import type { VrSessionHandle } from './vr-session.js';
import type { VrSceneHandle } from './vr-scene.js';
import type { VrInteraction, VrInteractionFrameResult } from './vr-interaction.js';
import { VR_EXIT_TARGET_ID } from './vr-targets.js';
import { htmlToPlainText, wrapLines } from './vr-info-panel.js';

/**
 * Données résolues d'un hotspot pour le lecteur VR (M6 F-71).
 */
export type VrPlayerSceneData =
  | {
      kind: 'scene-link';
      targetSceneId: string;
      arrivalYaw?: number;
    }
  | {
      kind: 'tour-link';
      hotspotId: string;
    }
  | {
      kind: 'info';
      text?: string;
      rtl?: boolean;
    };

/**
 * Dépendances injectées pour le contrôleur de visite VR (M6 F-71).
 */
export interface VrPlayerDeps {
  session: Pick<VrSessionHandle, 'enter' | 'exit' | 'isActive'>;
  scene: Pick<VrSceneHandle, 'setMarkers' | 'setTexture' | 'getMarkerTargets'> & {
    setYaw?: (yaw: number) => void;
  };
  interaction: VrInteraction;
  panel: {
    show(lines: string[], rtl?: boolean): void;
    hide(): void;
  };
  getGazeDir: () => { yaw: number; pitch: number } | null;
  loadTexture: (sceneId: string) => Promise<unknown>;
  getSceneData: (hotspotId: string) => VrPlayerSceneData | null;
  showScene: (sceneId: string) => Promise<void>;
  openTourLink?: (hotspotId: string) => void | Promise<void>;
}

/**
 * Interface du lecteur de visite en réalité virtuelle (M6 F-71).
 */
export interface VrPlayer {
  frame(nowMs: number): VrInteractionFrameResult;
  handleNavigate(hotspotId: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTexture(value: unknown): value is THREE.Texture {
  if (!isRecord(value)) {
    return false;
  }
  return value.isTexture === true;
}

/**
 * Crée le lecteur de visite VR sans dépendance directe à WebGL ni au DOM (M6 F-71).
 *
 * Coordonne la boucle d'interaction immersive (regard, fondu, sélection)
 * et la gestion des actions de navigation et de sortie VR.
 *
 * @param deps Dépendances injectées (session, scène, interaction, panneau, etc.).
 * @returns Le contrôleur VrPlayer.
 */
export function createVrPlayer(deps: VrPlayerDeps): VrPlayer {
  function frame(nowMs: number): VrInteractionFrameResult {
    return deps.interaction.frame(deps.getGazeDir(), nowMs);
  }

  function handleNavigate(hotspotId: string): void {
    deps.panel.hide();

    if (hotspotId === VR_EXIT_TARGET_ID) {
      void deps.session.exit();
      return;
    }

    const data = deps.getSceneData(hotspotId);
    if (data === null) {
      return;
    }

    if (data.kind === 'scene-link') {
      const targetSceneId = data.targetSceneId;
      const arrivalYaw = data.arrivalYaw;
      const navPromise = (async () => {
        try {
          const texture = await deps.loadTexture(targetSceneId);
          if (isTexture(texture) || texture === null) {
            deps.scene.setTexture(texture);
          }
          await deps.showScene(targetSceneId);
          deps.scene.setYaw?.(typeof arrivalYaw === 'number' ? arrivalYaw : 0);
        } catch {
          // Erreur de chargement absorbée : pas de setTexture ni de crash
        }
      })();
      void navPromise.catch(() => {});
      return;
    }

    if (data.kind === 'tour-link') {
      const exitPromise = (async () => {
        try {
          await deps.session.exit();
          if (deps.openTourLink !== undefined) {
            await deps.openTourLink(data.hotspotId);
          }
        } catch {
          // Erreur absorbée
        }
      })();
      void exitPromise.catch(() => {});
      return;
    }

    const lines = wrapLines(htmlToPlainText(data.text ?? ''), 40, 8);
    deps.panel.show(lines, data.rtl);
  }

  return {
    frame,
    handleNavigate,
  };
}
