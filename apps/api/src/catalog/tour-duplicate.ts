import { HotspotType, type LocalizedText } from '@xplor/shared';

/** Espace puis « (copie) » : le titre français ne se colle pas au suffixe. */
export const DUPLICATE_FR_TITLE_SUFFIX = ' (copie)';

/** Scène source non supprimée → scène copiée. */
export type SceneCopyIds = ReadonlyMap<string, string>;

/** Liens d'un hotspot source, réduits à ce que le remappage doit décider. */
export type DuplicateHotspotLink = {
  id: string;
  type: HotspotType;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
};

/** Liens à écrire sur la copie. `id` reste celui du hotspot source, pour le rapprochement. */
export type RemappedHotspotLink = {
  id: string;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
};

/**
 * Remappe les références internes d'une visite dupliquée.
 * `copies` associe chaque scène source non supprimée à sa copie.
 * Un `SCENE_LINK` dont la cible n'est pas dans la carte (scène supprimée, non copiée)
 * reçoit `targetSceneId` null : la copie ne pointe jamais vers une scène source.
 * Un `TOUR_LINK` conserve `targetTourId` et `targetTourSceneId`.
 * Un lien vers la visite source n'est pas réécrit : la création l'interdit (`TOUR_LINK_SELF`).
 */
export function remapDuplicateLinks(
  startSceneId: string | null,
  hotspots: readonly DuplicateHotspotLink[],
  copies: SceneCopyIds,
): { startSceneId: string | null; hotspots: readonly RemappedHotspotLink[] } {
  return {
    startSceneId: remapSceneId(startSceneId, copies),
    hotspots: hotspots.map((hotspot) => remapHotspot(hotspot, copies)),
  };
}

/** Seul `fr` reçoit le suffixe. `ar` et `en` restent ceux de la source. */
export function duplicateFrenchTitle(title: LocalizedText): LocalizedText {
  return { ...title, fr: `${title.fr}${DUPLICATE_FR_TITLE_SUFFIX}` };
}

function remapHotspot(hotspot: DuplicateHotspotLink, copies: SceneCopyIds): RemappedHotspotLink {
  if (hotspot.type === HotspotType.SCENE_LINK) {
    return {
      id: hotspot.id,
      targetSceneId: remapSceneId(hotspot.targetSceneId, copies),
      targetTourId: hotspot.targetTourId,
      targetTourSceneId: hotspot.targetTourSceneId,
    };
  }
  return {
    id: hotspot.id,
    targetSceneId: hotspot.targetSceneId,
    targetTourId: hotspot.targetTourId,
    targetTourSceneId: hotspot.targetTourSceneId,
  };
}

function remapSceneId(sceneId: string | null, copies: SceneCopyIds): string | null {
  if (sceneId === null) {
    return null;
  }
  return copies.get(sceneId) ?? null;
}
