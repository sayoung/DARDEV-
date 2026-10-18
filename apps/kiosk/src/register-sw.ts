export interface ServiceWorkerRegistrationLike {
  readonly scope?: string;
}

export interface ServiceWorkerContainerLike {
  register(
    scriptURL: string,
    options?: { scope?: string },
  ): Promise<ServiceWorkerRegistrationLike>;
}

export interface ServiceWorkerNavigatorLike {
  readonly serviceWorker: ServiceWorkerContainerLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isServiceWorkerNavigator(
  value: unknown,
): value is ServiceWorkerNavigatorLike {
  if (!isRecord(value)) {
    return false;
  }
  if (!('serviceWorker' in value)) {
    return false;
  }
  const sw = value.serviceWorker;
  if (!isRecord(sw)) {
    return false;
  }
  return 'register' in sw && typeof sw.register === 'function';
}

/**
 * Enregistre le service worker du kiosque Xplor (M5 F-62).
 *
 * @param nav Instance du navigateur (navigator ou faux objet de test).
 * @param scriptUrl Chemin d'accès au script du service worker (par défaut '/sw.js').
 * @returns L'enregistrement du service worker ou null si non supporté / en cas d'erreur.
 */
export async function registerServiceWorker(
  nav: unknown,
  scriptUrl: string = '/sw.js',
): Promise<ServiceWorkerRegistrationLike | null> {
  if (!isServiceWorkerNavigator(nav)) {
    return null;
  }

  try {
    const registration = await nav.serviceWorker.register(scriptUrl);
    return registration;
  } catch (error) {
    console.warn('[SW] Échec de l’enregistrement du service worker :', error);
    return null;
  }
}
