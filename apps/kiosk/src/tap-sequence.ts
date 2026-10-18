export interface TapSequenceDetectorOptions {
  requiredTaps?: number;
  windowMs?: number;
  now?: () => number;
  onTrigger: () => void;
}

export interface TapSequenceDetector {
  tap(): void;
}

/**
 * Détecte une séquence d'appuis rapprochés dans une fenêtre temporelle glissante (F-67).
 *
 * Utilisé pour le geste de maintenance caché (par exemple 5 appuis sur le logo en 3 s).
 * À chaque appui, seuls les appuis survenus dans les `windowMs` précédentes sont conservés.
 * Lorsque `requiredTaps` est atteint dans la fenêtre, `onTrigger` est appelé une fois
 * et le compteur d'appuis est réinitialisé à zéro.
 */
export function createTapSequenceDetector({
  requiredTaps = 5,
  windowMs = 3000,
  now = () => Date.now(),
  onTrigger,
}: TapSequenceDetectorOptions): TapSequenceDetector {
  if (!Number.isInteger(requiredTaps) || requiredTaps <= 0) {
    throw new RangeError('requiredTaps must be a positive integer');
  }

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new RangeError('windowMs must be a positive finite number');
  }

  if (typeof onTrigger !== 'function') {
    throw new TypeError('onTrigger must be a function');
  }

  if (typeof now !== 'function') {
    throw new TypeError('now must be a function');
  }

  let taps: number[] = [];

  const tap = (): void => {
    const currentTime = now();
    const cutoff = currentTime - windowMs;

    const recentTaps = taps.filter((timestamp) => timestamp >= cutoff && timestamp <= currentTime);
    recentTaps.push(currentTime);

    if (recentTaps.length >= requiredTaps) {
      taps = [];
      onTrigger();
    } else {
      taps = recentTaps;
    }
  };

  return {
    tap,
  };
}
