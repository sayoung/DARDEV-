import { describe, expect, it } from 'vitest';
import {
  TourGraphSceneSchema,
  type LocalizedText,
  type TourGraphScene,
} from '@xplor/shared';

import { groupScenesIntoPlaces } from './places.js';

function makeScene(id: string, title: string, thumb = `thumb-${id}.jpg`): TourGraphScene {
  return TourGraphSceneSchema.parse({
    id,
    title,
    caption: null,
    panorama: {
      preview: `preview-${id}.jpg`,
      web: `web-${id}.jpg`,
      tiles: { width: 512, cols: 2, rows: 1, baseUrl: `tiles-${id}` },
    },
    initialView: { yaw: 0, pitch: 0, zoom: 0 },
    narrationUrl: null,
    ambientUrl: null,
    thumb,
    hotspots: [],
  });
}

describe('groupScenesIntoPlaces', () => {
  it('retourne une liste vide pour une entrée vide', () => {
    const places = groupScenesIntoPlaces([]);
    expect(places).toEqual([]);
  });

  it('regroupe les scènes consécutives ayant le même nom après retrait du suffixe (n/m)', () => {
    const scenes: TourGraphScene[] = [
      makeScene('s1', 'Salon (1/3)', 'thumb-1.jpg'),
      makeScene('s2', 'Salon (2/3)', 'thumb-2.jpg'),
      makeScene('s3', 'Salon (3/3)', 'thumb-3.jpg'),
    ];

    const places = groupScenesIntoPlaces(scenes);

    expect(places).toEqual([
      {
        name: 'Salon',
        count: 3,
        firstSceneId: 's1',
        thumb: 'thumb-1.jpg',
        sceneIds: ['s1', 's2', 's3'],
      },
    ]);
  });

  it('gère les scènes sans suffixe : chaque scène forme un lieu seule', () => {
    const scenes: TourGraphScene[] = [
      makeScene('s1', 'Piscine', 'thumb-1.jpg'),
      makeScene('s2', 'Terrasse', 'thumb-2.jpg'),
    ];

    const places = groupScenesIntoPlaces(scenes);

    expect(places).toEqual([
      {
        name: 'Piscine',
        count: 1,
        firstSceneId: 's1',
        thumb: 'thumb-1.jpg',
        sceneIds: ['s1'],
      },
      {
        name: 'Terrasse',
        count: 1,
        firstSceneId: 's2',
        thumb: 'thumb-2.jpg',
        sceneIds: ['s2'],
      },
    ]);
  });

  it('maintient des lieux séparés pour des scènes sans suffixe même consécutives et de même titre', () => {
    const scenes: TourGraphScene[] = [
      makeScene('s1', 'Couloir', 'thumb-1.jpg'),
      makeScene('s2', 'Couloir', 'thumb-2.jpg'),
    ];

    const places = groupScenesIntoPlaces(scenes);

    expect(places).toEqual([
      {
        name: 'Couloir',
        count: 1,
        firstSceneId: 's1',
        thumb: 'thumb-1.jpg',
        sceneIds: ['s1'],
      },
      {
        name: 'Couloir',
        count: 1,
        firstSceneId: 's2',
        thumb: 'thumb-2.jpg',
        sceneIds: ['s2'],
      },
    ]);
  });

  it('conserve deux entrées séparées pour deux lieux non consécutifs portant le même nom', () => {
    const scenes: TourGraphScene[] = [
      makeScene('s1', 'Patio (1/2)', 'thumb-1.jpg'),
      makeScene('s2', 'Jardin (1/1)', 'thumb-2.jpg'),
      makeScene('s3', 'Patio (2/2)', 'thumb-3.jpg'),
    ];

    const places = groupScenesIntoPlaces(scenes);

    expect(places).toEqual([
      {
        name: 'Patio',
        count: 1,
        firstSceneId: 's1',
        thumb: 'thumb-1.jpg',
        sceneIds: ['s1'],
      },
      {
        name: 'Jardin',
        count: 1,
        firstSceneId: 's2',
        thumb: 'thumb-2.jpg',
        sceneIds: ['s2'],
      },
      {
        name: 'Patio',
        count: 1,
        firstSceneId: 's3',
        thumb: 'thumb-3.jpg',
        sceneIds: ['s3'],
      },
    ]);
  });

  it('garde le thumb de la première scène du lieu', () => {
    const scenes: TourGraphScene[] = [
      makeScene('s10', 'Kasbah (1/2)', 'first-thumb.jpg'),
      makeScene('s11', 'Kasbah (2/2)', 'second-thumb.jpg'),
    ];

    const places = groupScenesIntoPlaces(scenes);

    expect(places).toHaveLength(1);
    const firstPlace = places[0];
    expect(firstPlace).toBeDefined();
    if (firstPlace) {
      expect(firstPlace.thumb).toBe('first-thumb.jpg');
    }
  });

  it('résout le titre quand il est fourni sous forme LocalizedText avec repli sur fr', () => {
    const titleLocalized1: LocalizedText = { fr: 'Chambre (1/2)', en: 'Bedroom (1/2)' };
    const titleLocalized2: LocalizedText = { fr: 'Chambre (2/2)', en: 'Bedroom (2/2)' };

    const scene1 = {
      ...makeScene('s1', 'dummy'),
      title: titleLocalized1,
    };
    const scene2 = {
      ...makeScene('s2', 'dummy'),
      title: titleLocalized2,
    };

    const placesEn = groupScenesIntoPlaces([scene1, scene2], 'en');
    expect(placesEn).toEqual([
      {
        name: 'Bedroom',
        count: 2,
        firstSceneId: 's1',
        thumb: 'thumb-s1.jpg',
        sceneIds: ['s1', 's2'],
      },
    ]);

    const placesAr = groupScenesIntoPlaces([scene1, scene2], 'ar');
    expect(placesAr).toEqual([
      {
        name: 'Chambre',
        count: 2,
        firstSceneId: 's1',
        thumb: 'thumb-s1.jpg',
        sceneIds: ['s1', 's2'],
      },
    ]);
  });
});
