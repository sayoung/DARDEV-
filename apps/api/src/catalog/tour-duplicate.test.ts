import { HotspotType } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import {
  DUPLICATE_FR_TITLE_SUFFIX,
  duplicateFrenchTitle,
  remapDuplicateLinks,
  type DuplicateHotspotLink,
} from './tour-duplicate.js';

const PORTE = 'porte';
const JARDIN = 'jardin';
const REMPARTS = 'remparts';
const SUPPRIMEE = 'supprimee';
const PORTE_COPIE = 'porte-copie';
const JARDIN_COPIE = 'jardin-copie';
const REMPARTS_COPIE = 'remparts-copie';
const AUTRE_VISITE = 'autre-visite';
const SCENE_AUTRE = 'scene-autre';

const copies = new Map<string, string>([
  [PORTE, PORTE_COPIE],
  [JARDIN, JARDIN_COPIE],
  [REMPARTS, REMPARTS_COPIE],
]);

function sceneLink(id: string, targetSceneId: string | null): DuplicateHotspotLink {
  return {
    id,
    type: HotspotType.SCENE_LINK,
    targetSceneId,
    targetTourId: null,
    targetTourSceneId: null,
  };
}

describe('remapDuplicateLinks', () => {
  it('remappe la scène de départ et les SCENE_LINK vers les copies', () => {
    const result = remapDuplicateLinks(
      PORTE,
      [sceneLink('vers-jardin', JARDIN), sceneLink('vers-remparts', REMPARTS)],
      copies,
    );

    expect(result.startSceneId).toBe(PORTE_COPIE);
    expect(result.hotspots).toEqual([
      {
        id: 'vers-jardin',
        targetSceneId: JARDIN_COPIE,
        targetTourId: null,
        targetTourSceneId: null,
      },
      {
        id: 'vers-remparts',
        targetSceneId: REMPARTS_COPIE,
        targetTourId: null,
        targetTourSceneId: null,
      },
    ]);
  });

  it('ne laisse aucun SCENE_LINK pointer vers une scène source non copiée', () => {
    const result = remapDuplicateLinks(SUPPRIMEE, [sceneLink('vers-supprimee', SUPPRIMEE)], copies);

    expect(result.startSceneId).toBeNull();
    expect(result.hotspots[0]?.targetSceneId).toBeNull();
    expect(result.hotspots[0]?.targetSceneId).not.toBe(SUPPRIMEE);
  });

  it('conserve la visite cible d’un TOUR_LINK', () => {
    const result = remapDuplicateLinks(
      null,
      [
        {
          id: 'vers-autre',
          type: HotspotType.TOUR_LINK,
          targetSceneId: null,
          targetTourId: AUTRE_VISITE,
          targetTourSceneId: SCENE_AUTRE,
        },
      ],
      copies,
    );

    expect(result.startSceneId).toBeNull();
    expect(result.hotspots).toEqual([
      {
        id: 'vers-autre',
        targetSceneId: null,
        targetTourId: AUTRE_VISITE,
        targetTourSceneId: SCENE_AUTRE,
      },
    ]);
  });

  it('laisse une cible absente à null', () => {
    const result = remapDuplicateLinks(null, [sceneLink('sans-cible', null)], new Map());

    expect(result.startSceneId).toBeNull();
    expect(result.hotspots[0]?.targetSceneId).toBeNull();
  });
});

describe('duplicateFrenchTitle', () => {
  it('suffixe seulement le français', () => {
    expect(
      duplicateFrenchTitle({ fr: 'Visite manuelle', ar: 'زيارة', en: 'Manual tour' }),
    ).toEqual({
      fr: `Visite manuelle${DUPLICATE_FR_TITLE_SUFFIX}`,
      ar: 'زيارة',
      en: 'Manual tour',
    });
  });
});
