import type { VrSessionHandle } from './vr-session.js';
import type { VrSceneHandle } from './vr-scene.js';
import type { VrInteraction, VrInteractionFrameResult } from './vr-interaction.js';
import { VR_EXIT_TARGET_ID } from './vr-targets.js';

/**
 * Dépendances injectées pour le contrôleur de visite VR (M6 F-71).
 */
export interface VrPlayerDeps {
  session: Pick<VrSessionHandle, 'enter' | 'exit' | 'isActive'>;
  scene: Pick<VrSceneHandle, 'setMarkers' | 'setTexture' | 'getMarkerTargets'>;
  interaction: VrInteraction;
  panel: {
    show(lines: string[], rtl?: boolean): void;
    hide(): void;
  };
  getGazeDir: () => { yaw: number; pitch: number } | null;
  loadTexture: (sceneId: string) => Promise<unknown>;
  getSceneData: (hotspotId: string) => {
    kind: 'tour-link' | 'info';
    targetSceneId?: string;
    text?: string;
    rtl?: boolean;
  } | null;
  showScene: (sceneId: string) => Promise<void>;
}

/**
 * Interface du lecteur de visite en réalité virtuelle (M6 F-71).
 */
export interface VrPlayer {
  frame(nowMs: number): VrInteractionFrameResult;
  handleNavigate(hotspotId: string): void;
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
    if (hotspotId === VR_EXIT_TARGET_ID) {
      void deps.session.exit();
      return;
    }
  }

  return {
    frame,
    handleNavigate,
  };
}
