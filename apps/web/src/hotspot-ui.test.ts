/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHotspotClick } from './hotspot-ui.js';
import { TourGraph, TourGraphSchema } from '@xplor/shared';

describe('handleHotspotClick', () => {
  let graph: TourGraph;
  const labels = { close: 'Fermer', previous: 'Précédent', next: 'Suivant' };
  const deps = {
    openUrl: vi.fn(),
    onTourLink: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';

    const mockGraph = {
      id: 'tour-1',
      contentVersion: 1,
      lang: 'fr',
      title: 'Test Tour',
      summary: 'Summary',
      city: 'City',
      categories: [],
      coverUrl: null,
      practicalInfo: null,
      location: null,
      startSceneId: 'scene-1',
      scenes: [
        {
          id: 'scene-1',
          title: 'Scene 1',
          caption: null,
          panorama: {
            preview: 'preview.jpg',
            web: 'web.jpg',
            tiles: { width: 1000, cols: 2, rows: 2, baseUrl: 'tiles/' },
          },
          initialView: { yaw: 0, pitch: 0, zoom: 50 },
          narrationUrl: null,
          ambientUrl: null,
          thumb: 'thumb.jpg',
          hotspots: [
            {
              type: 'SCENE_LINK',
              id: 'h-scene',
              yaw: 0,
              pitch: 0,
              label: 'Scene',
              icon: 'ARROW',
              targetSceneId: 'scene-2',
            },
            {
              type: 'INFO',
              id: 'h-info',
              yaw: 1,
              pitch: 1,
              label: 'Info Title',
              icon: 'INFO',
              bodyHtml: '<p>Info Body</p>',
              images: ['img1.jpg'],
            },
            {
              type: 'MEDIA',
              id: 'h-media',
              yaw: 2,
              pitch: 2,
              label: 'Media Title',
              icon: 'PLAY',
              media: [{ url: 'video.mp4', mimeType: 'video/mp4' }],
            },
            {
              type: 'URL',
              id: 'h-url',
              yaw: 3,
              pitch: 3,
              label: 'Url Title',
              icon: 'INFO',
              url: 'https://example.com',
            },
            {
              type: 'TOUR_LINK',
              id: 'h-tour',
              yaw: 4,
              pitch: 4,
              label: 'Tour Title',
              icon: 'PORTAL',
              targetTourId: 'tour-2',
            },
          ],
        },
      ],
      linkedTours: [],
    };

    // Validate to ensure it matches the schema
    graph = TourGraphSchema.parse(mockGraph);
  });

  it('does nothing if scene is unknown', () => {
    handleHotspotClick(document, graph, 'unknown-scene', 'h-info', labels, deps);
    expect(document.getElementById('info-panel')).toBeNull();
  });

  it('does nothing if hotspot is unknown', () => {
    handleHotspotClick(document, graph, 'scene-1', 'unknown-hotspot', labels, deps);
    expect(document.getElementById('info-panel')).toBeNull();
  });

  it('does nothing for SCENE_LINK (handled by viewer-core natively if we pass action, but hotspotAction returns null)', () => {
    handleHotspotClick(document, graph, 'scene-1', 'h-scene', labels, deps);
    expect(document.getElementById('info-panel')).toBeNull();
    expect(document.getElementById('media-overlay')).toBeNull();
    expect(deps.openUrl).not.toHaveBeenCalled();
    expect(deps.onTourLink).not.toHaveBeenCalled();
  });

  it('opens info panel for INFO hotspot', () => {
    handleHotspotClick(document, graph, 'scene-1', 'h-info', labels, deps);
    const panel = document.getElementById('info-panel');
    expect(panel).not.toBeNull();
    expect(panel?.querySelector('h2')?.textContent).toBe('Info Title');
    expect(panel?.innerHTML).toContain('<p>Info Body</p>');
    expect(panel?.querySelector('img')?.src).toContain('img1.jpg');
  });

  it('opens media overlay for MEDIA hotspot', () => {
    handleHotspotClick(document, graph, 'scene-1', 'h-media', labels, deps);
    const overlay = document.getElementById('media-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelector('video')?.src).toContain('video.mp4');
  });

  it('calls openUrl for URL hotspot', () => {
    handleHotspotClick(document, graph, 'scene-1', 'h-url', labels, deps);
    expect(deps.openUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('calls onTourLink for TOUR_LINK hotspot', () => {
    handleHotspotClick(document, graph, 'scene-1', 'h-tour', labels, deps);
    expect(deps.onTourLink).toHaveBeenCalledWith('h-tour');
  });
});
