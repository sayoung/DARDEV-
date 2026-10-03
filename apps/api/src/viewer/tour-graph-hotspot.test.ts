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

  describe('TOUR_LINK', () => {
    const row: HotspotRow = {
      ...defaultRow,
      type: 'TOUR_LINK',
      targetTourId: 't-2',
      targetTourSceneId: 's-t-2',
    };

    it('retourne un TOUR_LINK valide pour audience public (targetSceneId issu de targetTourSceneId)', () => {
      const result = toGraphHotspot(row, defaultCtx);
      expect(result).toEqual({
        type: HotspotType.TOUR_LINK,
        id: 'h-1',
        yaw: 0,
        pitch: 0,
        label: 'Sortie',
        icon: HotspotIcon.ARROW,
        targetTourId: 't-2',
        targetSceneId: 's-t-2',
        arrivalYaw: 1.5,
      });
    });

    it('retourne null si targetTourId est absent', () => {
      expect(toGraphHotspot({ ...row, targetTourId: null }, defaultCtx)).toBeNull();
    });

    it('retourne valide si audience est kiosk et que targetTourId est autorisé', () => {
      const ctx: HotspotCtx = {
        ...defaultCtx,
        audience: 'kiosk',
        allowedTourIds: new Set(['t-2']),
      };
      const result = toGraphHotspot(row, ctx);
      expect(result?.type).toBe(HotspotType.TOUR_LINK);
    });

    it('retourne null si audience est kiosk et que targetTourId n\'est pas autorisé (ou allowedTourIds absent)', () => {
      const ctx1: HotspotCtx = { ...defaultCtx, audience: 'kiosk', allowedTourIds: new Set(['t-3']) };
      expect(toGraphHotspot(row, ctx1)).toBeNull();

      const ctx2: HotspotCtx = { ...defaultCtx, audience: 'kiosk' };
      expect(toGraphHotspot(row, ctx2)).toBeNull();
    });
  });

  describe('URL', () => {
    const row: HotspotRow = {
      ...defaultRow,
      type: 'URL',
      url: 'https://example.com',
    };

    it('retourne un URL valide pour audience public', () => {
      const result = toGraphHotspot(row, defaultCtx);
      expect(result).toEqual({
        type: HotspotType.URL,
        id: 'h-1',
        yaw: 0,
        pitch: 0,
        label: 'Sortie',
        icon: HotspotIcon.ARROW,
        url: 'https://example.com',
      });
    });

    it('retourne null si url est absent', () => {
      expect(toGraphHotspot({ ...row, url: null }, defaultCtx)).toBeNull();
    });

    it('retourne null pour audience kiosk', () => {
      expect(toGraphHotspot(row, { ...defaultCtx, audience: 'kiosk' })).toBeNull();
    });

    it('retourne null si url est javascript: (échoue à la validation)', () => {
      expect(toGraphHotspot({ ...row, url: 'javascript:alert(1)' }, defaultCtx)).toBeNull();
    });
  });

  describe('INFO', () => {
    it('gère le fallback fr, échappe le HTML et découpe en paragraphes', () => {
      const row: HotspotRow = {
        ...defaultRow,
        type: 'INFO',
        icon: null,
        body: {
          fr: 'Ligne 1\n\n<script>alert(1)</script>\r\n\r\nLigne 3 avec & et " et \'',
        },
      };

      const result = toGraphHotspot(row, { ...defaultCtx, lang: 'ar' });
      expect(result).toEqual({
        type: HotspotType.INFO,
        id: 'h-1',
        yaw: 0,
        pitch: 0,
        label: 'مخرج',
        icon: HotspotIcon.INFO,
        images: [],
        bodyHtml: '<p>Ligne 1</p><p>&lt;script&gt;alert(1)&lt;/script&gt;</p><p>Ligne 3 avec &amp; et &quot; et &#39;</p>',
      });
      expect(result?.type === HotspotType.INFO ? result.bodyHtml : '').not.toContain('<script');
    });

    it('retourne bodyHtml vide si le body est absent ou invalide', () => {
      const row: HotspotRow = { ...defaultRow, type: 'INFO', body: null };
      const result = toGraphHotspot(row, defaultCtx);
      expect(result?.type === HotspotType.INFO ? result.bodyHtml : null).toBe('');
    });
  });

  describe('MEDIA', () => {
    it('construit la liste de médias dans l\'ordre, ignore les ids absents, retourne null si vide', () => {
      const mediaMap = new Map();
      mediaMap.set('m-1', { url: 'url1.jpg', mimeType: 'image/jpeg' });
      mediaMap.set('m-3', { url: 'url3.mp4', mimeType: 'video/mp4' });

      const ctx: HotspotCtx = { ...defaultCtx, media: mediaMap };
      
      const row: HotspotRow = {
        ...defaultRow,
        type: 'MEDIA',
        icon: null,
        mediaAssetIds: ['m-3', 'm-2', 'm-1'],
      };

      const result = toGraphHotspot(row, ctx);
      expect(result).toEqual({
        type: HotspotType.MEDIA,
        id: 'h-1',
        yaw: 0,
        pitch: 0,
        label: 'Sortie',
        icon: HotspotIcon.PHOTO,
        media: [
          { url: 'url3.mp4', mimeType: 'video/mp4' },
          { url: 'url1.jpg', mimeType: 'image/jpeg' },
        ],
      });

      const rowEmpty: HotspotRow = { ...row, mediaAssetIds: ['m-missing'] };
      expect(toGraphHotspot(rowEmpty, ctx)).toBeNull();
    });
  });

  it('retourne null si le label est invalide', () => {
    const row = { ...defaultRow, label: { en: 'Only english is not valid' } };
    expect(toGraphHotspot(row, defaultCtx)).toBeNull();
  });
});
