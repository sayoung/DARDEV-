import { describe, expect, it } from 'vitest';
import { HotspotResponse, HotspotType, HotspotIcon } from '@xplor/shared';
import { editorMarkers } from './scene-editor.js';

describe('editorMarkers', () => {
  const baseHotspot: HotspotResponse = {
    id: 'h1',
    sceneId: 's1',
    type: HotspotType.INFO,
    yaw: 1.5,
    pitch: -0.5,
    label: { fr: 'Information', en: 'Info' },
    targetSceneId: null,
    targetTourId: null,
    targetTourSceneId: null,
    body: { fr: 'Détails' },
    url: null,
    arrivalYaw: null,
    mediaAssetIds: [],
    icon: HotspotIcon.INFO,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('retourne une liste vide si aucun hotspot', () => {
    expect(editorMarkers([], 'fr')).toEqual([]);
  });

  it('conserve yaw et pitch', () => {
    const markers = editorMarkers([baseHotspot], 'fr');
    expect(markers[0]?.position.yaw).toBe(1.5);
    expect(markers[0]?.position.pitch).toBe(-0.5);
  });

  it('utilise le libellé dans la langue demandée', () => {
    const markers = editorMarkers([baseHotspot], 'en');
    expect(markers[0]?.tooltip).toBe('Info');
  });

  it('se replie sur fr si la langue demandée manque', () => {
    const markers = editorMarkers([baseHotspot], 'ar');
    expect(markers[0]?.tooltip).toBe('Information');
  });

  it('génère className en minuscules par type', () => {
    const hotspots: HotspotResponse[] = [
      { ...baseHotspot, id: 'h1', type: HotspotType.SCENE_LINK },
      { ...baseHotspot, id: 'h2', type: HotspotType.TOUR_LINK },
      { ...baseHotspot, id: 'h3', type: HotspotType.INFO },
      { ...baseHotspot, id: 'h4', type: HotspotType.MEDIA },
      { ...baseHotspot, id: 'h5', type: HotspotType.URL },
    ];
    const markers = editorMarkers(hotspots, 'fr');
    
    expect(markers[0]?.className).toBe('xplor-marker xplor-marker-scene-link');
    expect(markers[1]?.className).toBe('xplor-marker xplor-marker-tour-link');
    expect(markers[2]?.className).toBe('xplor-marker xplor-marker-info');
    expect(markers[3]?.className).toBe('xplor-marker xplor-marker-media');
    expect(markers[4]?.className).toBe('xplor-marker xplor-marker-url');
  });
});
