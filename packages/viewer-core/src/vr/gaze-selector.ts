/**
 * Options de configuration du sélecteur par regard fixe (gaze interaction - M6 F-71).
 */
export interface GazeSelectorOptions {
  dwellMs?: number;
}

/**
 * Résultat d'une étape de mise à jour du sélecteur par regard fixe.
 */
export interface GazeUpdateResult {
  progress: number;
  selectedId: string | null;
}

/**
 * Interface du sélecteur par regard fixe (machine à états pure).
 */
export interface GazeSelector {
  update(targetId: string | null, nowMs: number): GazeUpdateResult;
  reset(): void;
}

/**
 * Crée un sélecteur par regard fixe (gaze interaction pour la VR - M6 F-71).
 *
 * Machine à états pure, sans dépendance au DOM ni à Three.js.
 *
 * - `progress` va de 0 à 1 selon la durée de fixation continue de la même cible.
 * - `selectedId` est renseigné une seule fois quand `dwellMs` (défaut: 2000 ms) est atteint sur la même cible.
 * - La cible doit ensuite être quittée (ou `reset()` appelé) avant une nouvelle sélection.
 * - Changer de cible ou passer à `null` remet à zéro.
 *
 * @param options Options de configuration (`dwellMs`, durée requise en ms, défaut: 2000).
 */
export function createGazeSelector(options: GazeSelectorOptions = {}): GazeSelector {
  const dwellMs =
    typeof options.dwellMs === 'number' && Number.isFinite(options.dwellMs) && options.dwellMs > 0
      ? options.dwellMs
      : 2000;

  let currentTargetId: string | null = null;
  let startTimeMs: number | null = null;
  let hasSelected = false;

  function reset(): void {
    currentTargetId = null;
    startTimeMs = null;
    hasSelected = false;
  }

  function update(targetId: string | null, nowMs: number): GazeUpdateResult {
    if (targetId === null) {
      reset();
      return { progress: 0, selectedId: null };
    }

    if (targetId !== currentTargetId) {
      currentTargetId = targetId;
      startTimeMs = nowMs;
      hasSelected = false;
      return { progress: 0, selectedId: null };
    }

    if (startTimeMs === null) {
      startTimeMs = nowMs;
      hasSelected = false;
      return { progress: 0, selectedId: null };
    }

    const elapsed = Math.max(0, nowMs - startTimeMs);
    const progress = Math.min(1, elapsed / dwellMs);

    if (progress >= 1) {
      if (!hasSelected) {
        hasSelected = true;
        return { progress: 1, selectedId: currentTargetId };
      }
      return { progress: 1, selectedId: null };
    }

    return { progress, selectedId: null };
  }

  return {
    update,
    reset,
  };
}
