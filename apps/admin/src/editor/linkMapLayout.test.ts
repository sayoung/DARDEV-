import { describe, it, expect } from 'vitest';
import { layoutLinkMap } from './linkMapLayout';
import { TourLinkMap } from '@xplor/shared';

describe('layoutLinkMap', () => {
  it('devrait traiter une carte vide (carte vide -> tableaux vides)', () => {
    const map: TourLinkMap = { nodes: [], edges: [] };
    const result = layoutLinkMap(map);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('devrait disposer une chaîne A -> B -> C sur 3 niveaux', () => {
    const map: TourLinkMap = {
      nodes: [
        { id: 'A', label: 'Scene A', kind: 'scene', isStart: true, orphan: false },
        { id: 'B', label: 'Scene B', kind: 'scene', isStart: false, orphan: false },
        { id: 'C', label: 'Scene C', kind: 'scene', isStart: false, orphan: false },
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', kind: 'scene_link' },
        { id: 'e2', source: 'B', target: 'C', kind: 'scene_link' },
      ],
    };

    const result = layoutLinkMap(map);
    
    // A est au niveau 0
    expect(result.nodes.find(n => n.id === 'A')).toMatchObject({ x: 0, y: 0, orphan: false });
    // B est au niveau 1
    expect(result.nodes.find(n => n.id === 'B')).toMatchObject({ x: 240, y: 0, orphan: false });
    // C est au niveau 2
    expect(result.nodes.find(n => n.id === 'C')).toMatchObject({ x: 480, y: 0, orphan: false });
    expect(result.edges).toEqual(map.edges);
  });

  it('devrait disposer deux branches sur le même niveau avec des y différents', () => {
    const map: TourLinkMap = {
      nodes: [
        { id: 'A', label: 'Start', kind: 'scene', isStart: true, orphan: false },
        { id: 'B', label: 'Branch 1', kind: 'scene', isStart: false, orphan: false },
        { id: 'C', label: 'Branch 2', kind: 'scene', isStart: false, orphan: false },
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', kind: 'scene_link' },
        { id: 'e2', source: 'A', target: 'C', kind: 'scene_link' },
      ],
    };

    const result = layoutLinkMap(map);
    
    expect(result.nodes.find(n => n.id === 'A')).toMatchObject({ x: 0, y: 0 });
    
    // B et C sont au niveau 1 (x = 240), avec des y = 0 et y = 120
    const b = result.nodes.find(n => n.id === 'B');
    const c = result.nodes.find(n => n.id === 'C');
    
    expect(b?.x).toBe(240);
    expect(c?.x).toBe(240);
    
    expect(b?.y).toBe(0);
    expect(c?.y).toBe(120);
  });

  it('devrait placer un orphelin dans la colonne finale', () => {
    const map: TourLinkMap = {
      nodes: [
        { id: 'A', label: 'Start', kind: 'scene', isStart: true, orphan: false },
        { id: 'B', label: 'Reached', kind: 'scene', isStart: false, orphan: false },
        { id: 'C', label: 'Orphan', kind: 'scene', isStart: false, orphan: false },
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', kind: 'scene_link' },
      ],
    };

    const result = layoutLinkMap(map);
    
    expect(result.nodes.find(n => n.id === 'A')).toMatchObject({ x: 0, y: 0, orphan: false });
    expect(result.nodes.find(n => n.id === 'B')).toMatchObject({ x: 240, y: 0, orphan: false });
    
    // L'orphelin C devrait être au niveau max + 1 = 2 (x = 480)
    expect(result.nodes.find(n => n.id === 'C')).toMatchObject({ x: 480, y: 0, orphan: true });
  });

  it('devrait assurer le déterminisme (même entrée, même sortie)', () => {
    const map: TourLinkMap = {
      nodes: [
        { id: 'A', label: 'Start', kind: 'scene', isStart: true, orphan: false },
        { id: 'B', label: 'Node B', kind: 'scene', isStart: false, orphan: false },
        { id: 'C', label: 'Node C', kind: 'scene', isStart: false, orphan: false },
        { id: 'D', label: 'Node D', kind: 'scene', isStart: false, orphan: false },
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', kind: 'scene_link' },
        { id: 'e2', source: 'A', target: 'C', kind: 'scene_link' },
        { id: 'e3', source: 'B', target: 'D', kind: 'scene_link' },
      ],
    };

    const result1 = layoutLinkMap(map);
    const result2 = layoutLinkMap(map);
    const result3 = layoutLinkMap(JSON.parse(JSON.stringify(map)) as TourLinkMap); // Clone profond

    expect(result1).toEqual(result2);
    expect(result1).toEqual(result3);
  });

  it('devrait lever une erreur de validation si les données sont invalides (Zod)', () => {
    const invalidMap = {
      nodes: [{ id: 'A', label: 'Start' }], // Manque isStart, kind, orphan
      edges: []
    } as unknown as TourLinkMap;

    expect(() => layoutLinkMap(invalidMap)).toThrow();
  });
});
