import type { KioskManifest } from '@xplor/shared';

export type ScreenState = 'ENROLL' | 'UNAVAILABLE' | 'LOADING' | 'HOME';
export type KioskScreenState = ScreenState;

export interface ResolveScreenParams {
  manifest: KioskManifest | null;
  disabled: boolean;
  enrolled: boolean;
}

/**
 * Détermine l'écran à afficher sur le kiosque (F-66).
 *
 * Priorités :
 * 1. Appareil non enrôlé → ENROLL
 * 2. Kiosque désactivé administrativement ou contrat/service hôtel inactif → UNAVAILABLE
 * 3. Manifeste absent ou en cours de chargement → LOADING
 * 4. Manifeste prêt et service actif → HOME
 */
export function resolveScreen({
  manifest,
  disabled,
  enrolled,
}: {
  manifest: KioskManifest | null;
  disabled: boolean;
  enrolled: boolean;
}): ScreenState {
  if (!enrolled) {
    return 'ENROLL';
  }
  if (disabled || manifest?.hotel.serviceActive === false) {
    return 'UNAVAILABLE';
  }
  if (manifest === null) {
    return 'LOADING';
  }
  return 'HOME';
}
