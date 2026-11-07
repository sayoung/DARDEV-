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
import { computeSceneOrientation } from './orientation.js';
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

  it('configures transition options as a function returning fade effect and 800ms speed', () => {
    const options = tourPluginOptions(validGraph);
    expect(typeof options.transitionOptions).toBe('function');
    if (typeof options.transitionOptions === 'function') {
      const res = options.transitionOptions({ id: 'scene-1', panorama: 'p1' });
      expect(res.effect).toBe('fade');
      expect(res.speed).toBe(TRANSITION_MS);
      expect(res.rotation).toBe(false);
    }
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

    const elementFromNull = createArrowElement(null);
    expect(elementFromNull.tagName).toBe('BUTTON');
    expect(elementFromNull.title).toBe('');

    const elementFromUndefined = createArrowElement(undefined);
    expect(elementFromUndefined.tagName).toBe('BUTTON');
    expect(elementFromUndefined.title).toBe('');
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

  it('verifies arrival orientation works in 2D and link click changes scene with fade', () => {
    const options = tourPluginOptions(validGraph);
    expect(options.renderMode).toBe('2d');
    expect(typeof options.transitionOptions).toBe('function');

    const link = options.nodes?.[0]?.links?.[0];
    expect(link).toBeDefined();
    if (!link) return;

    const targetScene = validGraph.scenes[1];
    expect(targetScene).toBeDefined();
    if (!targetScene) return;

    const orientation = computeSceneOrientation(targetScene, link);
    expect(orientation).toEqual({
      yaw: 0.8,
      pitch: 0,
    });
  });

  describe('transitionOptions callback (vue d\'arrivée sans saut)', () => {
    it('avec un lien qui a un arrivalYaw, rotateTo.yaw vaut cet arrivalYaw', () => {
      const options = tourPluginOptions(validGraph);
      if (typeof options.transitionOptions !== 'function') {
        throw new Error('transitionOptions should be a function');
      }

      const link: VirtualTourLink = {
        nodeId: 'scene-2',
        data: {
          arrivalYaw: 0.8,
        },
      };

      const result = options.transitionOptions(
        { id: 'scene-2', panorama: 'p2' },
        undefined,
        link
      );

      expect(result.effect).toBe('fade');
      expect(result.speed).toBe(TRANSITION_MS);
      expect(result.rotation).toBe(false);
      expect(result.rotateTo?.yaw).toBe(0.8);
      expect(result.rotateTo?.pitch).toBe(0);
      expect('zoomTo' in result).toBe(false);
    });

    it('sans lien (fromLink absent, cas de goToScene), rotateTo vaut l\'initialView de la cible', () => {
      const options = tourPluginOptions(validGraph);
      if (typeof options.transitionOptions !== 'function') {
        throw new Error('transitionOptions should be a function');
      }

      const scene2 = validGraph.scenes.find((s) => s.id === 'scene-2');
      if (!scene2) {
        throw new Error('scene-2 not found');
      }

      const result = options.transitionOptions({ id: 'scene-2', panorama: 'p2' });

      expect(result.effect).toBe('fade');
      expect(result.speed).toBe(TRANSITION_MS);
      expect(result.rotation).toBe(false);
      expect(result.rotateTo?.yaw).toBe(scene2.initialView.yaw);
      expect(result.rotateTo?.pitch).toBe(scene2.initialView.pitch);
      expect(result.zoomTo).toBe(scene2.initialView.zoom);
    });

    it('rotation vaut false', () => {
      const options = tourPluginOptions(validGraph);
      if (typeof options.transitionOptions !== 'function') {
        throw new Error('transitionOptions should be a function');
      }

      const linkWithArrival: VirtualTourLink = {
        nodeId: 'scene-2',
        data: { arrivalYaw: 1.2 },
      };
      const resultWithLink = options.transitionOptions(
        { id: 'scene-2', panorama: 'p2' },
        undefined,
        linkWithArrival
      );
      expect(resultWithLink.rotation).toBe(false);

      const resultWithoutLink = options.transitionOptions({ id: 'scene-2', panorama: 'p2' });
      expect(resultWithoutLink.rotation).toBe(false);

      const resultUnknown = options.transitionOptions({ id: 'scene-unknown', panorama: 'none' });
      expect(resultUnknown.rotation).toBe(false);
    });

    it('zoomTo n\'est présent que si zoom est défini', () => {
      const options = tourPluginOptions(validGraph);
      if (typeof options.transitionOptions !== 'function') {
        throw new Error('transitionOptions should be a function');
      }

      // Cas 1 : sans lien, la scène cible a un zoom défini (zoom: 1) -> zoomTo est présent et vaut 1
      const withoutLink = options.transitionOptions({ id: 'scene-2', panorama: 'p2' });
      expect('zoomTo' in withoutLink).toBe(true);
      expect(withoutLink.zoomTo).toBe(1);

      // Cas 2 : avec lien ayant arrivalYaw -> computeSceneOrientation ne renvoie pas zoom -> zoomTo est absent
      const withArrivalLink: VirtualTourLink = {
        nodeId: 'scene-2',
        data: { arrivalYaw: 0.8 },
      };
      const withArrival = options.transitionOptions(
        { id: 'scene-2', panorama: 'p2' },
        undefined,
        withArrivalLink
      );
      expect('zoomTo' in withArrival).toBe(false);
      expect(withArrival.zoomTo).toBeUndefined();

      // Cas 3 : avec un graphe dont la scène a un zoom explicite différent (ex: 0)
      const scene0 = validGraph.scenes.find((s) => s.id === 'scene-1');
      const scene1 = validGraph.scenes.find((s) => s.id === 'scene-2');
      if (!scene0 || !scene1) {
        throw new Error('fixtures scenes not found');
      }
      const customGraph = TourGraphSchema.parse({
        ...validGraph,
        scenes: [
          scene0,
          {
            ...scene1,
            id: 'scene-zoom-zero',
            initialView: { yaw: 0, pitch: 0, zoom: 0 },
          },
        ],
      });
      const customOptions = tourPluginOptions(customGraph);
      if (typeof customOptions.transitionOptions !== 'function') {
        throw new Error('transitionOptions should be a function');
      }
      const resZero = customOptions.transitionOptions({ id: 'scene-zoom-zero', panorama: 'p2' });
      expect('zoomTo' in resZero).toBe(true);
      expect(resZero.zoomTo).toBe(0);
    });

    it('si la scène est introuvable, renvoie seulement fade, speed et rotation: false', () => {
      const options = tourPluginOptions(validGraph);
      if (typeof options.transitionOptions !== 'function') {
        throw new Error('transitionOptions should be a function');
      }

      const result = options.transitionOptions({ id: 'scene-inconnue', panorama: 'px' });

      expect(result).toEqual({
        effect: 'fade',
        speed: TRANSITION_MS,
        rotation: false,
      });
      expect('rotateTo' in result).toBe(false);
      expect('zoomTo' in result).toBe(false);
    });
  });
});
