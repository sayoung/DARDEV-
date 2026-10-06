import { describe, it, expect } from 'vitest';
import { toMarkers, hotspotKind } from './scene-markers.js';
import { TourGraphScene, HotspotType, HotspotIcon, TourGraphSceneSchema } from '@xplor/shared';

describe('hotspotKind', () => {
  it('should map HotspotType to kind string correctly', () => {
    expect(hotspotKind(HotspotType.TOUR_LINK)).toBe('tour-link');
    expect(hotspotKind(HotspotType.INFO)).toBe('info');
    expect(hotspotKind(HotspotType.MEDIA)).toBe('media');
    expect(hotspotKind(HotspotType.URL)).toBe('url');
    expect(hotspotKind(HotspotType.SCENE_LINK)).toBe('scene-link');
  });
});

describe('scene-markers', () => {
  it('should exclude SCENE_LINK and convert other hotspot types correctly', () => {
    const rawScene = {
      id: 'scene-1',
      title: 'Scene 1',
      caption: null,
      panorama: {
        preview: 'http://example.com/preview.jpg',
        web: 'http://example.com/web.jpg',
        tiles: {
          width: 8192,
          cols: 16,
          rows: 8,
          baseUrl: 'http://example.com/tiles',
        },
      },
      initialView: {
        yaw: 0,
        pitch: 0,
        zoom: 50,
      },
      narrationUrl: null,
      ambientUrl: null,
      thumb: 'http://example.com/thumb.jpg',
      hotspots: [
        {
          type: HotspotType.SCENE_LINK,
          id: 'h1',
          yaw: 0.1,
          pitch: 0.1,
          label: 'Vers la scène 2',
          icon: HotspotIcon.ARROW,
          targetSceneId: 'scene-2',
        },
        {
          type: HotspotType.TOUR_LINK,
          id: 'h2',
          yaw: 0.2,
          pitch: 0.2,
          label: 'Vers une autre visite',
          icon: HotspotIcon.PORTAL,
          targetTourId: 'tour-2',
        },
        {
          type: HotspotType.INFO,
          id: 'h3',
          yaw: 0.3,
          pitch: 0.3,
          label: 'Information',
          icon: HotspotIcon.INFO,
          bodyHtml: '<p>Test</p>',
          images: [],
        },
        {
          type: HotspotType.MEDIA,
          id: 'h4',
          yaw: 0.4,
          pitch: 0.4,
          label: 'Média',
          icon: HotspotIcon.PHOTO,
          media: [{ url: 'http://example.com/media.jpg', mimeType: 'image/jpeg' }],
        },
        {
          type: HotspotType.URL,
          id: 'h5',
          yaw: 0.5,
          pitch: 0.5,
          label: 'Lien externe',
          icon: HotspotIcon.INFO,
          url: 'https://example.com',
        },
      ],
    };

    const scene: TourGraphScene = TourGraphSceneSchema.parse(rawScene);

    const markers = toMarkers(scene);

    expect(markers).toHaveLength(4);
    
    expect(markers[0]).toEqual({
      id: 'h2',
      position: { yaw: 0.2, pitch: 0.2 },
      kind: 'tour-link',
      tooltip: 'Vers une autre visite',
      icon: HotspotIcon.PORTAL,
    });
    
    expect(markers[1]).toEqual({
      id: 'h3',
      position: { yaw: 0.3, pitch: 0.3 },
      kind: 'info',
      tooltip: 'Information',
      icon: HotspotIcon.INFO,
    });
    
    expect(markers[2]).toEqual({
      id: 'h4',
      position: { yaw: 0.4, pitch: 0.4 },
      kind: 'media',
      tooltip: 'Média',
      icon: HotspotIcon.PHOTO,
    });
    
    expect(markers[3]).toEqual({
      id: 'h5',
      position: { yaw: 0.5, pitch: 0.5 },
      kind: 'url',
      tooltip: 'Lien externe',
      icon: HotspotIcon.INFO,
    });
  });

  it('should return empty array when scene has no hotspots', () => {
    const rawScene = {
      id: 'scene-1',
      title: 'Scene 1',
      caption: null,
      panorama: {
        preview: 'http://example.com/preview.jpg',
        web: 'http://example.com/web.jpg',
        tiles: {
          width: 8192,
          cols: 16,
          rows: 8,
          baseUrl: 'http://example.com/tiles',
        },
      },
      initialView: {
        yaw: 0,
        pitch: 0,
        zoom: 50,
      },
      narrationUrl: null,
      ambientUrl: null,
      thumb: 'http://example.com/thumb.jpg',
      hotspots: [],
    };

    const scene = TourGraphSceneSchema.parse(rawScene);
    const markers = toMarkers(scene);
    expect(markers).toEqual([]);
  });
});
