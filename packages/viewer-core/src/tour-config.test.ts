/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest';
import {
  tourPluginOptions,
  TRANSITION_MS,
  ARROW_SIZE,
  CIRCULAR_ARROW_SVG,
  CIRCULAR_ARROW_DATA_URL,
  createArrowElement,
  getLinkTooltip,
  extractHotspotLabel,
} from './tour-config.js';
import { TourGraphSchema } from '@xplor/shared';
import type { VirtualTourLink } from '@photo-sphere-viewer/virtual-tour-plugin';

describe('tourPluginOptions (2D navigation arrows)', () => {
  const validGraph = TourGraphSchema.parse({
    id: 'tour-1',
    contentVersion: 1,
    lang: 'fr',
    title: 'Test',
    summary: 'Test',
    city: 'Test',
    categories: [],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: 'scene-1',
    scenes: [
      {
        id: 'scene-1',
        title: 'S1',
        caption: null,
        panorama: {
          preview: 'p1',
          web: 'w1',
          tiles: { width: 1, cols: 1, rows: 1, baseUrl: 'b1' }
        },
        initialView: { yaw: 0, pitch: 0, zoom: 1 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 't1',
        hotspots: [
          {
            id: 'hs-1',
            type: 'SCENE_LINK',
            yaw: 1.2,
            pitch: -0.3,
            label: 'Vers le salon',
            icon: 'ARROW',
            targetSceneId: 'scene-2',
            arrivalYaw: 0.8,
          },
        ]
      },
      {
        id: 'scene-2',
        title: 'S2',
        caption: null,
        panorama: {
          preview: 'p2',
          web: 'w2',
          tiles: { width: 1, cols: 1, rows: 1, baseUrl: 'b2' }
        },
        initialView: { yaw: 0, pitch: 0, zoom: 1 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 't2',
        hotspots: []
      }
    ],
    linkedTours: []
  });

  it('uses provided sceneId if valid', () => {
    const options = tourPluginOptions(validGraph, 'scene-2');
    expect(options.startNodeId).toBe('scene-2');
  });

  it('falls back to startSceneId if provided sceneId is unknown', () => {
    const options = tourPluginOptions(validGraph, 'unknown');
    expect(options.startNodeId).toBe('scene-1');
  });

  it('falls back to startSceneId if provided sceneId is null', () => {
    const options = tourPluginOptions(validGraph, null);
    expect(options.startNodeId).toBe('scene-1');
  });

  it('returns valid configuration in 2D mode with manual positioning', () => {
    const options = tourPluginOptions(validGraph);
    expect(options.nodes).toHaveLength(2);
    expect(options.positionMode).toBe('manual');
    expect(options.renderMode).toBe('2d');
    expect(options.preload).toBe(true);
  });

  it('configures transition options with fade effect and 800ms speed', () => {
    const options = tourPluginOptions(validGraph);
    expect(options.transitionOptions).toEqual({
      effect: 'fade',
      speed: TRANSITION_MS
    });
  });

  it('configures arrowStyle with 56px size, circular element, and drop shadow', () => {
    const options = tourPluginOptions(validGraph);
    expect(options.arrowStyle).toBeDefined();
    expect(options.arrowStyle?.size).toEqual({
      width: ARROW_SIZE,
      height: ARROW_SIZE,
    });
    expect(options.arrowStyle?.size).toEqual({
      width: 56,
      height: 56,
    });
    expect(options.arrowStyle?.style).toEqual({
      cursor: 'pointer',
      filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))',
    });
    expect(options.arrowStyle?.element).toBe(createArrowElement);
    expect(CIRCULAR_ARROW_SVG).toContain('<svg');
    expect(CIRCULAR_ARROW_DATA_URL).toContain('data:image/svg+xml');
  });

  it('createArrowElement creates accessible button with hotspot label and circular SVG', () => {
    const linkWithLabel: VirtualTourLink = {
      nodeId: 'scene-2',
      data: {
        arrivalYaw: 0.8,
        label: 'Vers le salon',
      },
    };

    const element = createArrowElement(linkWithLabel);

    expect(element.tagName).toBe('BUTTON');
    expect(element.getAttribute('type')).toBe('button');
    expect(element.className).toContain('psv-virtual-tour-arrow');
    expect(element.className).toContain('xplor-tour-arrow');
    expect(element.title).toBe('Vers le salon');
    expect(element.getAttribute('aria-label')).toBe('Vers le salon');

    const svg = element.querySelector('svg');
    expect(svg).not.toBeNull();
    const circle = element.querySelector('circle');
    expect(circle).not.toBeNull();
    const path = element.querySelector('path');
    expect(path).not.toBeNull();
  });

  it('createArrowElement handles links without label gracefully', () => {
    const linkWithoutLabel: VirtualTourLink = {
      nodeId: 'scene-2',
    };

    const element = createArrowElement(linkWithoutLabel);

    expect(element.tagName).toBe('BUTTON');
    expect(element.title).toBe('');
    expect(element.getAttribute('aria-label')).toBeNull();
    expect(element.querySelector('svg')).not.toBeNull();
  });

  it('extractHotspotLabel extracts string label safely without type coercion', () => {
    expect(extractHotspotLabel({ nodeId: 's', data: { label: 'Suivante' } })).toBe('Suivante');
    expect(extractHotspotLabel({ nodeId: 's', data: { label: 123 } })).toBe('');
    expect(extractHotspotLabel({ nodeId: 's', data: null })).toBe('');
    expect(extractHotspotLabel({ nodeId: 's' })).toBe('');
    expect(extractHotspotLabel(null)).toBe('');
    expect(extractHotspotLabel(undefined)).toBe('');
  });

  it('getLinkTooltip returns hotspot label on hover, or falls back to node content', () => {
    const linkWithLabel: VirtualTourLink = {
      nodeId: 'scene-2',
      data: {
        label: 'Vers le salon',
      },
    };
    expect(getLinkTooltip('<h3>S2</h3>', linkWithLabel)).toBe('Vers le salon');

    const linkWithoutLabel: VirtualTourLink = {
      nodeId: 'scene-2',
    };
    expect(getLinkTooltip('<h3>S2</h3>', linkWithoutLabel)).toBe('<h3>S2</h3>');

    const linkWithEmptyLabel: VirtualTourLink = {
      nodeId: 'scene-2',
      data: {
        label: '   ',
      },
    };
    expect(getLinkTooltip('<h3>S2</h3>', linkWithEmptyLabel)).toBe('<h3>S2</h3>');
  });

  it('passes 2D hotspot position (yaw, pitch) and arrivalYaw to tour node links', () => {
    const options = tourPluginOptions(validGraph);
    const node0 = options.nodes ? options.nodes[0] : undefined;
    expect(node0).toBeDefined();
    if (!node0) return;

    expect(node0.links).toEqual([
      {
        nodeId: 'scene-2',
        position: {
          yaw: 1.2,
          pitch: -0.3,
        },
        data: {
          arrivalYaw: 0.8,
          label: 'Vers le salon',
        },
      },
    ]);
  });
});
