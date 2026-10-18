/**
 * Types pour la détection de prise en charge WebXR / VR (M6 F-73).
 */
export interface VrSessionSupportSystem {
  isSessionSupported(mode: string): Promise<boolean>;
}

export interface VrNavigator {
  xr?: VrSessionSupportSystem;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasXrSystem(value: unknown): value is {
  xr: {
    isSessionSupported(mode: string): Promise<boolean>;
  };
} {
  if (!isRecord(value) || !('xr' in value)) {
    return false;
  }
  const xr = value.xr;
  if (!isRecord(xr) || !('isSessionSupported' in xr)) {
    return false;
  }
  return typeof xr.isSessionSupported === 'function';
}

/**
 * Détermine si le mode VR immersif est pris en charge (M6 F-73).
 *
 * Renvoie `false` si :
 * - `nav` ou `nav.xr` est absent
 * - `isSessionSupported('immersive-vr')` renvoie `false`
 * - la promesse est rejetée
 * - l'appel lève une exception synchrone
 *
 * Aucune erreur n'est propagée vers l'appelant.
 * Par défaut, utilise `globalThis.navigator`.
 *
 * @param nav Objet navigateur optionnel (utile pour l'injection en tests).
 */
export async function isVrSupported(
  nav?: {
    xr?: {
      isSessionSupported(mode: string): Promise<boolean>;
    };
  },
): Promise<boolean> {
  try {
    const target: unknown =
      nav !== undefined
        ? nav
        : typeof globalThis !== 'undefined' && 'navigator' in globalThis
          ? globalThis.navigator
          : undefined;

    if (!hasXrSystem(target)) {
      return false;
    }

    const supported = await target.xr.isSessionSupported('immersive-vr');
    return supported;
  } catch {
    return false;
  }
}
