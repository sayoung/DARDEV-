import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkMapGraph } from './LinkMapGraph';
import { TourLinkMap } from '@xplor/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'catalog.tours.linkMap.start') return 'Départ :';
      return key;
    },
  }),
}));

vi.mock('@xyflow/react', () => {
  return {
    ReactFlow: ({ nodes }: { nodes: { id: string, className: string, data: { label: string } }[] }) => (
      <div data-testid="react-flow">
        {nodes.map(node => (
          <div
            key={node.id}
            data-testid="rf-node"
            className={node.className}
          >
            {node.data.label}
          </div>
        ))}
      </div>
    ),
    Background: () => <div data-testid="rf-background" />,
    Controls: () => <div data-testid="rf-controls" />,
    MarkerType: { ArrowClosed: 'arrowclosed' },
  };
});

vi.mock('@xyflow/react/dist/style.css', () => ({}));

const mockMap: TourLinkMap = {
  nodes: [
    {
      id: 'start-node',
      kind: 'scene',
      label: 'Scene Start',
      isStart: true,
      orphan: false,
    },
    {
      id: 'orphan-node',
      kind: 'scene',
      label: 'Scene Orphan',
      isStart: false,
      orphan: true,
    },
    {
      id: 'external-node',
      kind: 'external',
      label: 'External Tour',
      isStart: false,
      orphan: false,
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'start-node',
      target: 'external-node',
      kind: 'scene_link', // Can be tour_link also
    },
    {
      id: 'edge-2',
      source: 'external-node',
      target: 'start-node', // loop just for edge testing
      kind: 'tour_link',
    }
  ],
};

describe('LinkMapGraph', () => {
  it('renders 3 nodes with correct labels and classes', () => {
    render(<LinkMapGraph map={mockMap} />);

    const nodes = screen.getAllByTestId('rf-node');
    expect(nodes).toHaveLength(3);

    // Node 1: Départ
    const startNode = screen.getByText('Départ : Scene Start');
    expect(startNode).toBeTruthy();
    
    // Node 2: Orphelin
    const orphanNode = screen.getByText('Scene Orphan');
    expect(orphanNode.className).toContain('border-destructive');

    // Node 3: Externe
    const externalNode = screen.getByText('External Tour');
    expect(externalNode.className).toContain('border-dashed');
  });
});
