import type { GazeSelector } from './gaze-selector.js';
import type { VrFade } from './vr-fade.js';
import type { HotspotTarget, SphericalPosition } from './vr-geometry.js';
import { pickHotspot } from './vr-geometry.js';

/**
 * Dépendances injectées pour le coordinateur d'interactions VR (M6 F-71).
 */
export interface VrInteractionDeps {
  gaze: GazeSelector;
  fade: VrFade;
  getTargets: () => HotspotTarget[];
  onNavigate: (hotspotId: string) => void;
  maxRad?: number;
}

/**
 * Résultat d'une étape de mise à jour (frame) du coordinateur d'interactions VR (M6 F-71).
 */
export interface VrInteractionFrameResult {
  progress: number;
  fadeOpacity: number;
  hoveredId: string | null;
}

/**
 * Interface du coordinateur d'interactions VR (M6 F-71).
 */
export interface VrInteraction {
  /**
   * Calcule les interactions pour la frame courante :
   * - Détermine le hotspot visé avec `pickHotspot`.
   * - Met à jour le sélecteur par regard fixe (`gaze.update`).
   * - Si une sélection survient (`selectedId`), démarre le fondu (`fade.start`).
   * - À la moitié du fondu (`onMidpoint`), appelle `onNavigate(selectedId)` exactement une fois.
   * - Pendant un fondu actif, toute nouvelle sélection est ignorée.
   *
   * @param gazeDir Direction sphérique du regard ({ yaw, pitch } en radians), ou null.
   * @param nowMs Horodatage courant en millisecondes.
   */
  frame(
    gazeDir: { yaw: number; pitch: number } | null,
    nowMs: number
  ): VrInteractionFrameResult;

  /**
   * Déclenche une sélection immédiate par manette (controller trigger / raycast).
   * Utilise le même fondu au noir confortable avec appel à `onNavigate(id)` au milieu.
   * Si un fondu est déjà actif, la sélection est ignorée.
   *
   * @param id Identifiant du hotspot sélectionné.
   * @param nowMs Horodatage courant en millisecondes.
   */
  selectNow(id: string, nowMs: number): void;

  /**
   * Réinitialise les états internes du sélecteur par regard et du fondu.
   */
  reset(): void;
}

function isValidGazeDir(
  dir: { yaw: number; pitch: number } | null
): dir is SphericalPosition {
  return (
    dir !== null &&
    typeof dir === 'object' &&
    typeof dir.yaw === 'number' &&
    Number.isFinite(dir.yaw) &&
    typeof dir.pitch === 'number' &&
    Number.isFinite(dir.pitch)
  );
}

/**
 * Assemble les briques pures du mode VR (regard fixe, géométrie sphérique et fondu au noir - M6 F-71).
 *
 * Machine à états pure coordonnant :
 * 1. La détection du hotspot ciblé par la vue de l'utilisateur (`pickHotspot`).
 * 2. L'accumulation de fixation (`gaze.update`) avec retour visuel de progression (0 à 1).
 * 3. La transition visuelle confortable au noir (`fade.start` / `fade.update`) évitant la cinétose.
 * 4. La navigation vers la scène cible (`onNavigate`) appelée au noir complet au milieu du fondu.
 * 5. L'interaction directe par manette (`selectNow`) réutilisant le même cycle de fondu.
 *
 * @param deps Dépendances injectées (gaze, fade, getTargets, onNavigate, maxRad optionnel).
 * @returns Le contrôleur d'interaction VR.
 */
export function createVrInteraction(deps: VrInteractionDeps): VrInteraction {
  function selectNow(id: string, nowMs: number): void {
    if (deps.fade.isActive()) {
      return;
    }
    if (typeof id !== 'string' || id.trim().length === 0 || !Number.isFinite(nowMs)) {
      return;
    }
    deps.fade.start(nowMs, () => {
      deps.onNavigate(id);
    });
  }

  function frame(
    gazeDir: { yaw: number; pitch: number } | null,
    nowMs: number
  ): VrInteractionFrameResult {
    const wasFadeActive = deps.fade.isActive();
    const currentMs = Number.isFinite(nowMs) ? nowMs : 0;

    let targets: readonly HotspotTarget[] = [];
    if (typeof deps.getTargets === 'function') {
      try {
        const retrieved = deps.getTargets();
        if (Array.isArray(retrieved)) {
          targets = retrieved;
        }
      } catch {
        targets = [];
      }
    }

    const targetId =
      isValidGazeDir(gazeDir) && targets.length > 0
        ? pickHotspot(gazeDir, targets, deps.maxRad)
        : null;

    const gazeResult = deps.gaze.update(targetId, currentMs);
    const selectedId = gazeResult.selectedId;

    if (selectedId !== null && !wasFadeActive) {
      deps.fade.start(currentMs, () => {
        deps.onNavigate(selectedId);
      });
    }

    const fadeResult = deps.fade.update(currentMs);

    return {
      progress: gazeResult.progress,
      fadeOpacity: fadeResult.opacity,
      hoveredId: targetId,
    };
  }

  function reset(): void {
    deps.gaze.reset();
    deps.fade.reset();
  }

  return {
    frame,
    selectNow,
    reset,
  };
}
