import { HotspotType } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { buildTourLinkMap } from './tour-link-map.js';

describe('buildTourLinkMap', () => {
  it('construit une chaîne A -> B -> C sans orpheline', () => {
    const map = buildTourLinkMap({
      startSceneId: 'scene-a',
      scenes: [
        {
          id: 'scene-a',
          title: 'Scène A',
          deleted: false,
          hotspots: [{ id: 'h-a-b', type: HotspotType.SCENE_LINK, targetSceneId: 'scene-b' }],
        },
        {
          id: 'scene-b',
          title: 'Scène B',
          deleted: false,
          hotspots: [{ id: 'h-b-c', type: HotspotType.SCENE_LINK, targetSceneId: 'scene-c' }],
        },
        {
          id: 'scene-c',
          title: 'Scène C',
          deleted: false,
          hotspots: [],
        },
      ],
    });

    expect(map.nodes).toHaveLength(3);
    expect(map.nodes.find((n) => n.id === 'scene-a')).toEqual({
      id: 'scene-a',
      kind: 'scene',
      label: 'Scène A',
      isStart: true,
      orphan: false,
    });
    expect(map.nodes.find((n) => n.id === 'scene-b')).toEqual({
      id: 'scene-b',
      kind: 'scene',
      label: 'Scène B',
      isStart: false,
      orphan: false,
    });
    expect(map.nodes.find((n) => n.id === 'scene-c')).toEqual({
      id: 'scene-c',
      kind: 'scene',
      label: 'Scène C',
      isStart: false,
      orphan: false,
    });

    expect(map.edges).toHaveLength(2);
    expect(map.edges).toEqual(
      expect.arrayContaining([
        { id: 'h-a-b', source: 'scene-a', target: 'scene-b', kind: 'scene_link' },
        { id: 'h-b-c', source: 'scene-b', target: 'scene-c', kind: 'scene_link' },
      ]),
    );
  });

  it('marque une scène isolée D comme orpheline', () => {
    const map = buildTourLinkMap({
      startSceneId: 'scene-a',
      scenes: [
        {
          id: 'scene-a',
          title: 'Scène A',
          deleted: false,
          hotspots: [],
        },
        {
          id: 'scene-d',
          title: 'Scène D',
          deleted: false,
          hotspots: [],
        },
      ],
    });

    expect(map.nodes).toHaveLength(2);
    expect(map.nodes.find((n) => n.id === 'scene-a')?.orphan).toBe(false);
    expect(map.nodes.find((n) => n.id === 'scene-d')?.orphan).toBe(true);
    expect(map.edges).toHaveLength(0);
  });

  it('gère un cycle A -> B -> A correctement', () => {
    const map = buildTourLinkMap({
      startSceneId: 'scene-a',
      scenes: [
        {
          id: 'scene-a',
          title: 'Scène A',
          deleted: false,
          hotspots: [{ id: 'h-a-b', type: HotspotType.SCENE_LINK, targetSceneId: 'scene-b' }],
        },
        {
          id: 'scene-b',
          title: 'Scène B',
          deleted: false,
          hotspots: [{ id: 'h-b-a', type: HotspotType.SCENE_LINK, targetSceneId: 'scene-a' }],
        },
      ],
    });

    expect(map.nodes.every((n) => !n.orphan)).toBe(true);
    expect(map.edges).toHaveLength(2);
    expect(map.edges).toEqual(
      expect.arrayContaining([
        { id: 'h-a-b', source: 'scene-a', target: 'scene-b', kind: 'scene_link' },
        { id: 'h-b-a', source: 'scene-b', target: 'scene-a', kind: 'scene_link' },
      ]),
    );
  });

  it('ignore un hotspot vers une scène supprimée (et la scène supprimée est absente des nœuds)', () => {
    const map = buildTourLinkMap({
      startSceneId: 'scene-a',
      scenes: [
        {
          id: 'scene-a',
          title: 'Scène A',
          deleted: false,
          hotspots: [{ id: 'h-a-del', type: HotspotType.SCENE_LINK, targetSceneId: 'scene-deleted' }],
        },
        {
          id: 'scene-deleted',
          title: 'Scène Supprimée',
          deleted: true,
          hotspots: [],
        },
      ],
    });

    expect(map.nodes).toHaveLength(1);
    expect(map.nodes[0]?.id).toBe('scene-a');
    expect(map.edges).toHaveLength(0);
  });

  it('marque toutes les scènes comme orphelines si startSceneId est null', () => {
    const map = buildTourLinkMap({
      startSceneId: null,
      scenes: [
        {
          id: 'scene-a',
          title: 'Scène A',
          deleted: false,
          hotspots: [{ id: 'h-a-b', type: HotspotType.SCENE_LINK, targetSceneId: 'scene-b' }],
        },
        {
          id: 'scene-b',
          title: 'Scène B',
          deleted: false,
          hotspots: [],
        },
      ],
    });

    expect(map.nodes).toHaveLength(2);
    expect(map.nodes.every((n) => n.orphan)).toBe(true);
  });

  it('marque toutes les scènes comme orphelines si startSceneId pointe vers une scène inexistante ou supprimée', () => {
    const map = buildTourLinkMap({
      startSceneId: 'scene-deleted',
      scenes: [
        {
          id: 'scene-a',
          title: 'Scène A',
          deleted: false,
          hotspots: [{ id: 'h-a-b', type: HotspotType.SCENE_LINK, targetSceneId: 'scene-b' }],
        },
        {
          id: 'scene-b',
          title: 'Scène B',
          deleted: false,
          hotspots: [],
        },
        {
          id: 'scene-deleted',
          title: 'Scène Supprimée',
          deleted: true,
          hotspots: [],
        },
      ],
    });

    expect(map.nodes.filter((n) => n.id !== 'scene-deleted')).toHaveLength(2);
    expect(map.nodes.every((n) => n.orphan)).toBe(true);
  });
});
