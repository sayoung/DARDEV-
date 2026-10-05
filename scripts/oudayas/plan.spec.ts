import { describe, it, expect } from 'vitest';
import { buildTourPlan, TourData, generateId } from './plan.js';
import { HotspotType } from '@xplor/shared';

describe('buildTourPlan', () => {
  const mockData: TourData = {
    title: 'La Kasbah des Oudayas',
    city: 'Rabat',
    description: 'Une belle description',
    scenes: [
      { file: '001.jpg', name: 'Scène 1', info: 'Info 1' },
      { file: '002.jpg', name: 'Scène 2', info: 'Info 2' },
      { file: '003.jpg', name: 'Scène 3', info: 'Info 3' },
    ],
  };

  const mockAssetIds = {
    '001.jpg': generateId(),
    '002.jpg': generateId(),
    '003.jpg': generateId(),
  };

  const cityId = generateId();
  const categoryId = generateId();

  it('génère un plan de visite valide avec toutes les données', () => {
    const result = buildTourPlan(mockData, mockAssetIds, cityId, categoryId);

    expect(result.tour.title.fr).toBe('La Kasbah des Oudayas');
    expect(result.tour.summary.fr).toBe('Une belle description');
    expect(result.tour.cityId).toBe(cityId);
    expect(result.tour.categoryIds).toEqual([categoryId]);
    expect(result.tour.coverAssetId).toBe(mockAssetIds['001.jpg']);

    expect(result.scenes.length).toBe(3);

    // Scène 1
    const scene0 = result.scenes[0];
    if (!scene0) throw new Error('Scène 0 manquante');
    expect(scene0.payload.title.fr).toBe('Scène 1');
    expect(scene0.payload.panoramaAssetId).toBe(mockAssetIds['001.jpg']);
    expect(scene0.payload.weight).toBe(0);
    expect(scene0.hotspots.length).toBe(3);
    
    // Suivante (002.jpg)
    const nextHotspot = scene0.hotspots.find(h => h.label.fr === 'Suivante');
    expect(nextHotspot).toBeDefined();
    expect(nextHotspot?.type).toBe(HotspotType.SCENE_LINK);
    if (nextHotspot?.type === HotspotType.SCENE_LINK) {
      expect(nextHotspot.targetSceneId).toBe(result.scenes[1]?.id);
      expect(nextHotspot.yaw).toBe(0);
      expect(nextHotspot.pitch).toBe(-0.12);
    }

    // Précédente (003.jpg - la dernière)
    const prevHotspot = scene0.hotspots.find(h => h.label.fr === 'Précédente');
    expect(prevHotspot).toBeDefined();
    expect(prevHotspot?.type).toBe(HotspotType.SCENE_LINK);
    if (prevHotspot?.type === HotspotType.SCENE_LINK) {
      expect(prevHotspot.targetSceneId).toBe(result.scenes[2]?.id);
      expect(prevHotspot.yaw).toBe(Math.PI);
      expect(prevHotspot.pitch).toBe(-0.12);
    }

    // Info
    const infoHotspot = scene0.hotspots.find(h => h.label.fr === 'Information');
    expect(infoHotspot).toBeDefined();
    expect(infoHotspot?.type).toBe(HotspotType.INFO);
    if (infoHotspot?.type === HotspotType.INFO) {
      expect(infoHotspot.body.fr).toBe('Info 1');
      expect(infoHotspot.yaw).toBe(0.7);
      expect(infoHotspot.pitch).toBe(0.05);
    }
  });

  it('génère un plan pour une seule scène sans hotspots de navigation', () => {
    const singleData0 = mockData.scenes[0];
    if (!singleData0) throw new Error('mockData manquante');
    
    const singleData: TourData = {
      ...mockData,
      scenes: [singleData0],
    };
    
    const result = buildTourPlan(singleData, mockAssetIds, cityId, categoryId);
    
    expect(result.scenes.length).toBe(1);
    const scene0 = result.scenes[0];
    if (!scene0) throw new Error('Scène manquante');
    expect(scene0.hotspots.length).toBe(1); // Seulement le hotspot INFO
    
    const h0 = scene0.hotspots[0];
    if (!h0) throw new Error('Hotspot manquant');
    expect(h0.type).toBe(HotspotType.INFO);
  });

  it('échoue si la visite ne contient aucune scène', () => {
    const emptyData: TourData = { ...mockData, scenes: [] };
    expect(() => buildTourPlan(emptyData, mockAssetIds, cityId, categoryId))
      .toThrowError('La visite doit contenir au moins une scène');
  });

  it('échoue si un asset est manquant', () => {
    const incompleteAssets = { '001.jpg': mockAssetIds['001.jpg'] }; // Manque 002 et 003
    expect(() => buildTourPlan(mockData, incompleteAssets, cityId, categoryId))
      .toThrowError('Asset manquant pour le fichier 002.jpg');
  });
});
