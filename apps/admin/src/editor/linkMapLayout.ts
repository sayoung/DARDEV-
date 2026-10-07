import { TourLinkMap, TourLinkMapSchema } from '@xplor/shared';

export type LayoutNode = {
  id: string;
  label: string;
  kind: 'scene' | 'external';
  isStart: boolean;
  orphan: boolean;
  x: number;
  y: number;
};

export function layoutLinkMap(map: TourLinkMap): {
  nodes: LayoutNode[];
  edges: TourLinkMap['edges'];
} {
  const validatedMap = TourLinkMapSchema.parse(map);
  const { nodes, edges } = validatedMap;

  const startNodes = nodes.filter(n => n.isStart);
  
  const levels = new Map<number, string[]>();
  const visited = new Set<string>();
  
  const queue: { id: string; level: number }[] = startNodes.map(n => ({ id: n.id, level: 0 }));
  let maxLevel = -1;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { id, level } = current;

    if (visited.has(id)) {
      continue;
    }

    visited.add(id);
    
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    const currentLevelNodes = levels.get(level);
    if (currentLevelNodes) {
        currentLevelNodes.push(id);
    }
    
    maxLevel = Math.max(maxLevel, level);

    const outgoingEdges = edges.filter(e => e.source === id);
    
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.target)) {
        queue.push({ id: edge.target, level: level + 1 });
      }
    }
  }

  const orphans = nodes.filter(n => !visited.has(n.id));
  const orphanLevel = maxLevel + 1;
  
  if (orphans.length > 0) {
    levels.set(orphanLevel, orphans.map(n => n.id));
  }

  const coords = new Map<string, { x: number; y: number }>();
  
  for (const [level, nodeIds] of levels.entries()) {
    nodeIds.forEach((nodeId, index) => {
      coords.set(nodeId, {
        x: level * 240,
        y: index * 120,
      });
    });
  }

  const layoutNodes = nodes.map(node => {
    const coord = coords.get(node.id);
    const isNodeOrphan = !visited.has(node.id);
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      isStart: node.isStart,
      orphan: isNodeOrphan,
      x: coord ? coord.x : 0,
      y: coord ? coord.y : 0,
    };
  });

  return {
    nodes: layoutNodes,
    edges: edges,
  };
}
