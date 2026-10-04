import { describe, it, expect } from 'vitest';
import { resolveTourLink } from './tour-link.js';
import { TourGraph, TourGraphSchema, HotspotType, HotspotIcon } from '@xplor/shared';

const validGraph: TourGraph = TourGraphSchema.parse({
  id: 'tour1',
  contentVersion: 1,
  lang: 'fr',
  title: 'Test Tour',
  summary: 'A test tour',
  city: 'Test City',
  categories: [],
  coverUrl: null,
  practicalInfo: null,
  location: null,
  startSceneId: 'scene1',
  scenes: [
    {
      id: 'scene1',
      title: 'Scene 1',
      caption: null,
      panorama: {
        preview: 'preview.jpg',
        web: 'web.jpg',
        tiles: { width: 4096, cols: 8, rows: 4, baseUrl: 'tiles/' }
      },
      initialView: { yaw: 0, pitch: 0, zoom: 50 },
      narrationUrl: null,
      ambientUrl: null,
      thumb: 'thumb.jpg',
      hotspots: [
        {
          id: 'hs1',
          type: HotspotType.TOUR_LINK,
          yaw: 0,
          pitch: 0,
          label: 'Link to Tour 2',
          icon: HotspotIcon.ARROW,
          targetTourId: 'tour2',
          targetSceneId: 'scene2',
          arrivalYaw: 3.14
        },
        {
          id: 'hs2',
          type: HotspotType.SCENE_LINK,
          yaw: 0,
          pitch: 0,
          label: 'Link to Scene 2',
          icon: HotspotIcon.ARROW,
          targetSceneId: 'scene2'
        },
        {
          id: 'hs3',
          type: HotspotType.TOUR_LINK,
          yaw: 0,
          pitch: 0,
          label: 'Link to Tour 3',
          icon: HotspotIcon.ARROW,
          targetTourId: 'tour3'
        },
        {
          id: 'hs4',
          type: HotspotType.TOUR_LINK,
          yaw: 0,
          pitch: 0,
          label: 'Link to Tour 4',
          icon: HotspotIcon.ARROW,
          targetTourId: 'tour4'
        }
      ]
    }
  ],
  linkedTours: [
    {
      id: 'tour2',
      title: 'Tour 2',
      coverUrl: null,
      availableOffline: false,
      shareToken: 'token123'
    },
    {
      id: 'tour4',
      title: 'Tour 4',
      coverUrl: null,
      availableOffline: false,
      shareToken: null
    }
  ]
});

describe('resolveTourLink', () => {
  it('returns target info for a valid TOUR_LINK hotspot', () => {
    const result = resolveTourLink(validGraph, 'hs1');
    expect(result).toEqual({
      shareToken: 'token123',
      sceneId: 'scene2',
      arrivalYaw: 3.14,
      title: 'Tour 2'
    });
  });

  it('returns null for an unknown hotspot', () => {
    const result = resolveTourLink(validGraph, 'unknown_hs');
    expect(result).toBeNull();
  });

  it('returns null for a SCENE_LINK hotspot', () => {
    const result = resolveTourLink(validGraph, 'hs2');
    expect(result).toBeNull();
  });

  it('returns null if the linked tour is missing from the graph', () => {
    const result = resolveTourLink(validGraph, 'hs3');
    expect(result).toBeNull();
  });

  it('returns null if the linked tour has no shareToken', () => {
    const result = resolveTourLink(validGraph, 'hs4');
    expect(result).toBeNull();
  });
});
