import type { AppAction, AppStore } from './app-state.js';
import {
  createIdleController,
  type IdleController,
} from './idle-controller.js';
import {
  createTapSequenceDetector,
  type TapSequenceDetector,
} from './tap-sequence.js';

export interface WireInteractionsState {
  dispatch(action: AppAction): void;
}

export interface WireInteractionsOptions {
  doc: Document;
  state: WireInteractionsState | AppStore;
  idleTimeoutSeconds?: number;
  now?: () => number;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

export interface InteractionWiring {
  dispose(): void;
  destroy(): void;
  activity(): void;
  getIdleController(): IdleController;
  getTapDetector(): TapSequenceDetector;
  setIdleTimeoutSeconds(seconds: number): void;
}

function isLogoElement(target: EventTarget | null): boolean {
  if (target === null) {
    return false;
  }
  let current: Node | null = null;
  if (target instanceof Node) {
    current = target;
  }
  if (current === null) {
    return false;
  }
  const element = current instanceof Element ? current : current.parentElement;
  if (element === null) {
    return false;
  }
  if (typeof element.closest === 'function') {
    return element.closest('[data-logo]') !== null;
  }
  return false;
}

/**
 * Câblage des interactions globales du kiosque (F-63 / F-67).
 *
 * - Relie le contrôleur d'inactivité (F-63) aux événements `pointerdown` et `keydown` du document.
 * - Les événements actifs appellent la notification d'activité du contrôleur de veille.
 * - Lors du passage en veille, dispatche `IDLE`.
 * - Lors du réveil par une interaction, dispatche `WAKE`.
 * - Relie le détecteur de séquence d'appuis (F-67) : 5 appuis en 3 s sur l'élément `[data-logo]`
 *   déclenchent `OPEN_MAINTENANCE`.
 * - Renvoie un objet `{ dispose }` qui détache tous les écouteurs et annule les minuteurs en cours.
 */
export function wireInteractions({
  doc,
  state,
  idleTimeoutSeconds = 90,
  now = () => Date.now(),
  setTimeout: customSetTimeout,
  clearTimeout: customClearTimeout,
}: WireInteractionsOptions): InteractionWiring {
  let disposed = false;
  let activeTimerHandle: unknown = undefined;

  const setTimeoutFn =
    customSetTimeout ??
    ((callback: () => void, delayMs: number): unknown => {
      return globalThis.setTimeout(callback, delayMs);
    });

  const clearTimeoutFn =
    customClearTimeout ??
    ((handle: unknown): void => {
      if (typeof handle === 'number') {
        globalThis.clearTimeout(handle);
      }
    });

  const wrappedSetTimeout = (
    callback: () => void,
    delayMs: number,
  ): unknown => {
    const handle = setTimeoutFn(callback, delayMs);
    activeTimerHandle = handle;
    return handle;
  };

  const wrappedClearTimeout = (handle: unknown): void => {
    if (activeTimerHandle === handle) {
      activeTimerHandle = undefined;
    }
    clearTimeoutFn(handle);
  };

  const idleController = createIdleController({
    idleTimeoutSeconds,
    now,
    setTimeout: wrappedSetTimeout,
    clearTimeout: wrappedClearTimeout,
    onIdle() {
      if (disposed) {
        return;
      }
      state.dispatch({ type: 'IDLE' });
    },
    onWake() {
      if (disposed) {
        return;
      }
      state.dispatch({ type: 'WAKE' });
    },
  });

  const tapDetector = createTapSequenceDetector({
    requiredTaps: 5,
    windowMs: 3000,
    now,
    onTrigger() {
      if (disposed) {
        return;
      }
      state.dispatch({ type: 'OPEN_MAINTENANCE' });
    },
  });

  const notifyActivity = (): void => {
    if (disposed) {
      return;
    }
    idleController.notifyInteraction();
  };

  const handlePointerDown = (event: Event): void => {
    if (disposed) {
      return;
    }
    notifyActivity();

    if (isLogoElement(event.target)) {
      tapDetector.tap();
    }
  };

  const handleKeyDown = (): void => {
    if (disposed) {
      return;
    }
    notifyActivity();
  };

  doc.addEventListener('pointerdown', handlePointerDown);
  doc.addEventListener('keydown', handleKeyDown);

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    doc.removeEventListener('pointerdown', handlePointerDown);
    doc.removeEventListener('keydown', handleKeyDown);
    if (activeTimerHandle !== undefined) {
      clearTimeoutFn(activeTimerHandle);
      activeTimerHandle = undefined;
    }
  };

  return {
    dispose,
    destroy: dispose,
    activity: notifyActivity,
    getIdleController: () => idleController,
    getTapDetector: () => tapDetector,
    setIdleTimeoutSeconds: (seconds: number): void => {
      idleController.setIdleTimeoutSeconds(seconds);
    },
  };
}
