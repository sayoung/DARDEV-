import { describe, it, expect } from 'vitest';
import { toGraphHotspot, HotspotRow, HotspotCtx } from './tour-graph-hotspot.js';
import { HotspotType, HotspotIcon } from '@xplor/shared';

describe('toGraphHotspot', () => {
  const defaultCtx: HotspotCtx = {
    lang: 'fr',
    audience: 'public',
    media: new Map(),
  };

  const defaultRow: HotspotRow = {
    id: 'h-1',
    type: 'SCENE_LINK',
    yaw: 0,
    pitch: 0,
    label: { fr: 'Sortie', ar: 'مخرج' },
    targetSceneId: 's-2',
    targetTourId: null,
    targetTourSceneId: null,
    body: null,
    mediaAssetIds: [],
    url: null,
    icon: HotspotIcon.ARROW,
    arrivalYaw: 1.5,
  };

  it('retourne un SCENE_LINK valide', () => {
    const result = toGraphHotspot(defaultRow, defaultCtx);
    expect(result).toEqual({
      type: HotspotType.SCENE_LINK,
      id: 'h-1',
      yaw: 0,
      pitch: 0,
      label: 'Sortie',
      icon: HotspotIcon.ARROW,
      targetSceneId: 's-2',
      arrivalYaw: 1.5,
    });
  });

  it('retourne null si targetSceneId est absent pour SCENE_LINK', () => {
    const row = { ...defaultRow, targetSceneId: null };
    const result = toGraphHotspot(row, defaultCtx);
    expect(result).toBeNull();
  });

  it('localise le label en arabe avec repli sur fr quand la traduction manque', () => {
    // Label with missing translation
    const rowMissingAr = { ...defaultRow, label: { fr: 'Entrée' } };
    
    const resultArMissing = toGraphHotspot(rowMissingAr, { ...defaultCtx, lang: 'ar' });
    expect(resultArMissing?.label).toBe('Entrée'); // fallback to fr

    const rowWithAr = { ...defaultRow, label: { fr: 'Entrée', ar: 'مدخل' } };
    const resultAr = toGraphHotspot(rowWithAr, { ...defaultCtx, lang: 'ar' });
    expect(resultAr?.label).toBe('مدخل'); // localized to ar
  });

  it('retourne null pour les types non implémentés (TODO)', () => {
    const types: HotspotRow['type'][] = ['TOUR_LINK', 'INFO', 'MEDIA', 'URL'];
    for (const t of types) {
      const row = { ...defaultRow, type: t };
      expect(toGraphHotspot(row, defaultCtx)).toBeNull();
    }
  });

  it('retourne null si le label est invalide', () => {
    const row = { ...defaultRow, label: { en: 'Only english is not valid' } };
    expect(toGraphHotspot(row, defaultCtx)).toBeNull();
  });
});
