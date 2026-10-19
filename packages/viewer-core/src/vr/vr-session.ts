/**
 * Gestion du cycle de vie d'une session WebXR immersive VR (M6 F-70, F-72).
 *
 * Conçu avec des contrats structurels minimaux pour être testable
 * de manière déterministe et isolée sans API WebXR globale du navigateur.
 */

/**
 * Représentation structurelle minimale d'une session WebXR (M6 F-70).
 */
export interface XrSessionLike {
  addEventListener(type: 'end', cb: () => void): void;
  end(): Promise<void>;
}

/**
 * Sous-système WebXR minimal du renderer Three.js (M6 F-70).
 */
export interface VrRendererXrLike {
  enabled: boolean;
  setSession(s: XrSessionLike): Promise<void>;
}

/**
 * Renderer Three.js minimal requis pour piloter la VR et la boucle d'animation (M6 F-70).
 */
export interface VrRendererLike {
  xr: VrRendererXrLike;
  setAnimationLoop(cb: ((time: number) => void) | null): void;
}

/**
 * Système WebXR minimal pour la demande de session immersive VR (M6 F-70).
 */
export interface XrSystemLike {
  requestSession(mode: 'immersive-vr', init?: object): Promise<XrSessionLike>;
}

/**
 * Dépendances injectées pour initialiser une session VR (M6 F-70, F-72).
 */
export interface VrSessionDeps {
  xr: XrSystemLike;
  renderer: VrRendererLike;
  onFrame: (nowMs: number) => void;
  /**
   * Callback optionnel appelé lors de la fin de session déclenchée par l'événement 'end'
   * (sortie par le casque ou arrêt par le runtime WebXR).
   *
   * Remarque : l'appel programmatique à exit() arrête la session directement
   * sans déclencher onEnd.
   */
  onEnd?: () => void;
}

/**
 * Contrôleur de session VR exposé à l'application hôte (M6 F-70, F-72).
 */
export interface VrSessionHandle {
  /**
   * Démarre la session immersive VR.
   *
   * Idempotent si la session est déjà active.
   * Active renderer.xr.enabled, démarre la boucle d'animation appelant onFrame,
   * et rejette proprement en cas d'échec sans laisser de boucle active.
   *
   * En cas d'échec après l'obtention de la session (ex. échec de setSession),
   * session.end() est appelé pour libérer la ressource avant de propager l'erreur.
   */
  enter(init?: object): Promise<void>;

  /**
   * Quitte la session VR en cours.
   *
   * Appelle session.end() et arrête la boucle d'animation.
   * Idempotent si aucune session n'est active.
   *
   * Remarque : exit() arrête la boucle et termine la session sans appeler onEnd
   * (onEnd est exclusivement déclenché par l'événement 'end' émis par le casque).
   */
  exit(): Promise<void>;

  /**
   * Indique si une session VR est actuellement active.
   */
  isActive(): boolean;
}

interface VrSessionInternalState {
  currentSession: XrSessionLike | null;
  active: boolean;
  exitRequested: boolean;
  sessionEndedDuringEnter: boolean;
  endNotified: boolean;
}

/**
 * Crée un contrôleur de session immersive VR (M6 F-70, F-72).
 *
 * Contraintes M6 F-72 :
 * - Aucune rotation automatique de caméra n'est appliquée en mode VR pour préserver le confort
 *   visuel et limiter les risques de cinétose (seul le mouvement naturel de la tête guide la vue).
 * - Fréquence cible : 72 fps minimum sur casques autonomes (Meta Quest 3, Pico 4).
 *
 * @param deps Dépendances injectées (système XR, renderer Three.js, callbacks onFrame et onEnd).
 * @returns Le contrôleur de session VR.
 */
export function createVrSession(deps: VrSessionDeps): VrSessionHandle {
  const state: VrSessionInternalState = {
    currentSession: null,
    active: false,
    exitRequested: false,
    sessionEndedDuringEnter: false,
    endNotified: false,
  };

  let enteringPromise: Promise<void> | null = null;

  function stopLoopAndDisableXr(): void {
    deps.renderer.setAnimationLoop(null);
    deps.renderer.xr.enabled = false;
  }

  function isCancellationOrEndRequested(): boolean {
    return state.exitRequested || state.sessionEndedDuringEnter;
  }

  function handleEnd(): void {
    const wasActive = state.active;
    state.active = false;
    state.currentSession = null;
    stopLoopAndDisableXr();

    if (enteringPromise !== null) {
      state.sessionEndedDuringEnter = true;
    }

    if (wasActive && !state.endNotified) {
      state.endNotified = true;
      if (typeof deps.onEnd === 'function') {
        deps.onEnd();
      }
    }
  }

  async function enter(init?: object): Promise<void> {
    if (state.active && state.currentSession !== null) {
      return;
    }

    if (enteringPromise !== null) {
      return enteringPromise;
    }

    state.exitRequested = false;
    state.sessionEndedDuringEnter = false;
    state.endNotified = false;

    enteringPromise = (async () => {
      let session: XrSessionLike | null = null;
      try {
        deps.renderer.xr.enabled = true;
        session = await deps.xr.requestSession('immersive-vr', init);

        if (isCancellationOrEndRequested()) {
          try {
            await session.end();
          } catch {
            // Avaler l'erreur de fermeture
          }
          stopLoopAndDisableXr();
          return;
        }

        session.addEventListener('end', handleEnd);
        await deps.renderer.xr.setSession(session);

        if (isCancellationOrEndRequested()) {
          try {
            await session.end();
          } catch {
            // Avaler l'erreur de fermeture
          }
          stopLoopAndDisableXr();
          return;
        }

        state.currentSession = session;
        state.active = true;

        deps.renderer.setAnimationLoop((time: number) => {
          deps.onFrame(time);
        });
      } catch (error) {
        if (session !== null) {
          try {
            await session.end();
          } catch {
            // Avaler l'erreur de fermeture si session.end() échoue
          }
        }
        state.active = false;
        state.currentSession = null;
        stopLoopAndDisableXr();
        throw error;
      } finally {
        enteringPromise = null;
      }
    })();

    return enteringPromise;
  }

  async function exit(): Promise<void> {
    state.exitRequested = true;

    if (enteringPromise !== null) {
      try {
        await enteringPromise;
      } catch {
        // L'erreur éventuelle de enter() est propagée à l'appelant de enter()
      }
    }

    if (!state.active && state.currentSession === null) {
      return;
    }

    const session = state.currentSession;
    state.active = false;
    state.currentSession = null;
    stopLoopAndDisableXr();

    if (session !== null) {
      try {
        await session.end();
      } catch {
        // Avaler l'erreur de fermeture
      }
    }
  }

  function isActive(): boolean {
    return state.active;
  }

  return {
    enter,
    exit,
    isActive,
  };
}
