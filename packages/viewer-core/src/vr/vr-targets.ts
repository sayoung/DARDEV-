import {
  HotspotType,
  type TourGraph,
  type TourGraphScene,
} from '@xplor/shared';
import { resolveTourLink } from '../tour-link.js';
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
 * Parcourt directement `scene.hotspots` :
 * - SCENE_LINK : conservé si targetSceneId est présent dans les scènes du graphe.
 * - INFO : conservé.
 * - TOUR_LINK : conservé seulement si resolveTourLink(graph, hotspot.id) renvoie un lien avec shareToken non vide.
 * - Les types MEDIA et URL sont exclus en mode VR.
 *
 * @param scene Scène issue du graphe de visite (TourGraphScene).
 * @param graph Graphe complet de la visite (TourGraph).
 * @returns Liste des cibles { id, yaw, pitch } éligibles pour l'interaction VR.
 */
export function toVrTargets(
  scene: TourGraphScene,
  graph: TourGraph,
): HotspotTarget[] {
  const targets: HotspotTarget[] = [];

  for (const hotspot of scene.hotspots) {
    if (hotspot.type === HotspotType.SCENE_LINK) {
      if (
        typeof hotspot.targetSceneId === 'string' &&
        graph.scenes.some((s) => s.id === hotspot.targetSceneId)
      ) {
        targets.push({
          id: hotspot.id,
          yaw: hotspot.yaw,
          pitch: hotspot.pitch,
        });
      }
    } else if (hotspot.type === HotspotType.INFO) {
      targets.push({
        id: hotspot.id,
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
      });
    } else if (hotspot.type === HotspotType.TOUR_LINK) {
      const resolved = resolveTourLink(graph, hotspot.id);
      if (
        resolved !== null &&
        typeof resolved.shareToken === 'string' &&
        resolved.shareToken.length > 0
      ) {
        targets.push({
          id: hotspot.id,
          yaw: hotspot.yaw,
          pitch: hotspot.pitch,
        });
      }
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
