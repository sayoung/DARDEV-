import { KioskManifestSchema, type KioskManifest } from '@xplor/shared';

import type { Storage } from './credentials.js';

export const KIOSK_MANIFEST_KEY = 'xplor.kiosk.manifest';

/**
 * Persiste le manifeste du kiosque dans le stockage local (M5 F-62).
 */
export function saveManifest(storage: Storage, manifest: KioskManifest): void {
  const valid = KioskManifestSchema.parse(manifest);
  storage.setItem(KIOSK_MANIFEST_KEY, JSON.stringify(valid));
}

/**
 * Charge le manifeste du kiosque depuis le stockage local (M5 F-62).
 * Renvoie null en l'absence de manifeste stocké ou si les données sont invalides.
 */
export function loadManifest(storage: Storage): KioskManifest | null {
  const serialized = storage.getItem(KIOSK_MANIFEST_KEY);
  if (serialized === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(serialized);
    const result = KioskManifestSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Supprime le manifeste du kiosque du stockage local (réenrôlement F-67).
 */
export function clearManifest(storage: Storage): void {
  storage.removeItem(KIOSK_MANIFEST_KEY);
}
