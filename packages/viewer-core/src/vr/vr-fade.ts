/**
 * Options de configuration du fondu au noir en mode VR (M6 F-71).
 */
export interface VrFadeOptions {
  durationMs?: number;
}

/**
 * Résultat d'une étape de mise à jour du fondu au noir.
 */
export interface VrFadeResult {
  opacity: number;
  active: boolean;
}

/**
 * Interface de la machine à états pure du fondu au noir (confort VR).
 */
export interface VrFade {
  start(nowMs: number, onMidpoint: () => void): void;
  update(nowMs: number): VrFadeResult;
  isActive(): boolean;
  reset(): void;
}

/**
 * Crée une machine à états pure de fondu au noir pour le confort en mode VR (M6 F-71).
 *
 * En réalité virtuelle, les mouvements brutaux de caméra provoquent la cybercinétose.
 * Le fondu au noir assure une transition visuellement confortable sans mouvement artificiel :
 *
 * 1. L'opacité monte linéairement de 0 à 1 pendant la première moitié (0 à `durationMs / 2`).
 * 2. Au noir complet (`opacity === 1` au milieu), `onMidpoint` est appelé exactement une fois
 *    (changement de scène).
 * 3. L'opacité redescend linéairement de 1 à 0 pendant la seconde moitié (`durationMs / 2` à `durationMs`).
 * 4. À la fin (`elapsed >= durationMs`), l'opacité est à 0 et `active` passe à `false`.
 * 5. Un appel à `start()` pendant un fondu actif est strictement ignoré.
 *
 * @param options Options de configuration (`durationMs`, durée totale en ms, défaut: 300).
 */
export function createVrFade(options: VrFadeOptions = {}): VrFade {
  const durationMs =
    typeof options.durationMs === 'number' &&
    Number.isFinite(options.durationMs) &&
    options.durationMs > 0
      ? options.durationMs
      : 300;

  let active = false;
  let startTimeMs = 0;
  let midpointCalled = false;
  let onMidpointCallback: (() => void) | null = null;

  function reset(): void {
    active = false;
    startTimeMs = 0;
    midpointCalled = false;
    onMidpointCallback = null;
  }

  function start(nowMs: number, onMidpoint: () => void): void {
    if (active) {
      return;
    }
    if (!Number.isFinite(nowMs)) {
      return;
    }
    active = true;
    startTimeMs = nowMs;
    midpointCalled = false;
    onMidpointCallback = onMidpoint;
  }

  function update(nowMs: number): VrFadeResult {
    if (!active) {
      return { opacity: 0, active: false };
    }

    const currentMs = Number.isFinite(nowMs) ? nowMs : startTimeMs;
    const elapsed = Math.max(0, currentMs - startTimeMs);
    const halfDuration = durationMs / 2;

    if (elapsed < halfDuration) {
      const opacity = halfDuration > 0 ? elapsed / halfDuration : 1;
      return {
        opacity: Math.min(1, Math.max(0, opacity)),
        active: true,
      };
    }

    if (!midpointCalled) {
      midpointCalled = true;
      const callback = onMidpointCallback;
      if (callback !== null) {
        callback();
      }
    }

    if (elapsed >= durationMs) {
      active = false;
      onMidpointCallback = null;
      return {
        opacity: 0,
        active: false,
      };
    }

    const remaining = durationMs - elapsed;
    const opacity = halfDuration > 0 ? remaining / halfDuration : 0;

    return {
      opacity: Math.min(1, Math.max(0, opacity)),
      active: true,
    };
  }

  function isActive(): boolean {
    return active;
  }

  return {
    start,
    update,
    isActive,
    reset,
  };
}
