import { describe, it, expect } from 'vitest';
import { hotspotAction } from './hotspot-action.js';
import { TourGraphScene, HotspotType, HotspotIcon, TourGraphSceneSchema } from '@xplor/shared';

describe('hotspotAction', () => {
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
        id: 'h-scene',
        yaw: 0.1,
        pitch: 0.1,
        label: 'Vers la scène 2',
        icon: HotspotIcon.ARROW,
        targetSceneId: 'scene-2',
      },
      {
        type: HotspotType.TOUR_LINK,
        id: 'h-tour',
        yaw: 0.2,
        pitch: 0.2,
        label: 'Vers une autre visite',
        icon: HotspotIcon.PORTAL,
        targetTourId: 'tour-2',
      },
      {
        type: HotspotType.INFO,
        id: 'h-info',
        yaw: 0.3,
        pitch: 0.3,
        label: 'Information',
        icon: HotspotIcon.INFO,
        bodyHtml: '<p>Test</p>',
        images: ['http://example.com/img.jpg'],
      },
      {
        type: HotspotType.MEDIA,
        id: 'h-media',
        yaw: 0.4,
        pitch: 0.4,
        label: 'Média',
        icon: HotspotIcon.PHOTO,
        media: [{ url: 'http://example.com/media.jpg', mimeType: 'image/jpeg' }],
      },
      {
        type: HotspotType.URL,
        id: 'h-url',
        yaw: 0.5,
        pitch: 0.5,
        label: 'Lien externe',
        icon: HotspotIcon.INFO,
        url: 'https://example.com',
      },
    ],
  };

  const scene: TourGraphScene = TourGraphSceneSchema.parse(rawScene);

  it('should return null for unknown hotspot id', () => {
    expect(hotspotAction(scene, 'unknown')).toBeNull();
  });

  it('should return null for SCENE_LINK', () => {
    expect(hotspotAction(scene, 'h-scene')).toBeNull();
  });

  it('should return info action for INFO', () => {
    expect(hotspotAction(scene, 'h-info')).toEqual({
      kind: 'info',
      title: 'Information',
      bodyHtml: '<p>Test</p>',
      images: ['http://example.com/img.jpg'],
    });
  });

  it('should return media action for MEDIA', () => {
    expect(hotspotAction(scene, 'h-media')).toEqual({
      kind: 'media',
      title: 'Média',
      media: [{ url: 'http://example.com/media.jpg', mimeType: 'image/jpeg' }],
    });
  });

  it('should return url action for URL', () => {
    expect(hotspotAction(scene, 'h-url')).toEqual({
      kind: 'url',
      url: 'https://example.com',
    });
  });

  it('should return tour action for TOUR_LINK', () => {
    expect(hotspotAction(scene, 'h-tour')).toEqual({
      kind: 'tour',
      hotspotId: 'h-tour',
    });
  });
});
