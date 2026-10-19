import type { TourGraphScene } from '@xplor/shared';
import { toMarkers } from '../scene-markers.js';
import type { HotspotTarget } from './vr-geometry.js';

/**
 * Identifiant réservé pour la cible de sortie de la session VR (M6 F-71, F-72).
 */
export const VR_EXIT_TARGET_ID = '__xplor_vr_exit__';

/**
 * Cible permanente de sortie VR orientée vers le nadir / sol à portée de regard (M6 F-71, F-72).
 *
 * Positionnée à yaw: 0, pitch: -1.0 rad pour être accessible en baissant les yeux
 * sans interférer avec les hotspots situés au niveau de l'horizon.
 */
export const VR_EXIT_TARGET: HotspotTarget = {
  id: VR_EXIT_TARGET_ID,
  yaw: 0,
  pitch: -1.0,
};

/**
 * Extrait les cibles de hotspots interactives pour le mode VR depuis une scène (M6 F-71).
 *
 * Réutilise `toMarkers` pour extraire les marqueurs de la scène, puis filtre
 * pour ne retenir que les hotspots de type 'tour-link' et 'info'
 * (les types 'media' et 'url' sont exclus en mode VR).
 *
 * @param scene Scène issue du graphe de visite (TourGraphScene).
 * @returns Liste des cibles { id, yaw, pitch } éligibles pour l'interaction VR.
 */
export function toVrTargets(scene: TourGraphScene): HotspotTarget[] {
  const markers = toMarkers(scene);
  const targets: HotspotTarget[] = [];

  for (const marker of markers) {
    if (marker.kind === 'tour-link' || marker.kind === 'info') {
      targets.push({
        id: marker.id,
        yaw: marker.position.yaw,
        pitch: marker.position.pitch,
      });
    }
  }

  return targets;
}

/**
 * Ajoute la cible de sortie VR permanente à la fin de la liste des cibles (M6 F-71, F-72).
 *
 * Fonction pure et non-mutante : retourne un nouveau tableau sans modifier la liste originale.
 *
 * @param targets Liste des cibles candidates courantes.
 * @returns Nouveau tableau avec les cibles d'origine suivies de la cible de sortie VR.
 */
export function withExitTarget(targets: readonly HotspotTarget[]): HotspotTarget[] {
  return [...targets, VR_EXIT_TARGET];
}
