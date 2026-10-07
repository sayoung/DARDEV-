import { useTranslation } from 'react-i18next';
import { ReactFlow, Background, Controls, MarkerType, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TourLinkMap } from '@xplor/shared';
import { layoutLinkMap } from './linkMapLayout';
import { useMemo } from 'react';
import { cn } from '../lib/cn';

export interface LinkMapGraphProps {
  map: TourLinkMap;
}

export function LinkMapGraph({ map }: LinkMapGraphProps) {
  const { t } = useTranslation();

  const { nodes, edges } = useMemo(() => {
    const layout = layoutLinkMap(map);
    
    const rfNodes: Node[] = layout.nodes.map(n => {
      let label = n.label;
      if (n.isStart) {
        label = `${t('catalog.tours.linkMap.start')} ${label}`;
      }
      return {
        id: n.id,
        position: { x: n.x, y: n.y },
        data: { label },
        className: cn(
          'bg-background text-foreground px-4 py-2 rounded-md border-2 border-solid shadow-sm min-w-[150px] text-center font-medium',
          n.orphan ? 'border-destructive text-destructive' : 'border-primary',
          n.kind === 'external' && 'border-dashed',
        ),
      };
    });

    const rfEdges: Edge[] = layout.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: e.kind === 'tour_link' ? { strokeDasharray: '5 5' } : undefined,
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [map, t]);

  return (
    <div className="h-[480px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
