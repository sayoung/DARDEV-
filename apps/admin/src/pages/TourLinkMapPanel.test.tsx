import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { TourLinkMapPanel } from './TourLinkMapPanel.js';
import { getTourLinkMap } from '../api/catalog.js';
import { type TourLinkMap } from '@xplor/shared';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'common.loading': 'Chargement...',
    'common.error.generic': 'Une erreur est survenue.',
    'catalog.tours.linkMap.title': 'Carte des liens',
    'catalog.tours.linkMap.refresh': 'Actualiser',
    'catalog.tours.linkMap.orphans': 'Scènes orphelines',
    'catalog.tours.linkMap.noOrphans': 'Aucune scène orpheline',
    'catalog.tours.linkMap.empty': 'Aucune scène dans cette visite.'
  };
  return translations[key] || key;
};

// Setup translation mock
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: mockT,
      i18n: { language: 'fr' }
    })
  };
});

// Mock API
vi.mock('../api/catalog.js', () => ({
  getTourLinkMap: vi.fn(),
}));

// Mock LinkMapGraph
vi.mock('../editor/LinkMapGraph.js', () => ({
  LinkMapGraph: vi.fn(({ map }) => (
    <div data-testid="link-map-graph" data-map={JSON.stringify(map)}>
      Mock Graph
    </div>
  ))
}));

describe('TourLinkMapPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('(a) affiche d\'abord common.loading puis une carte avec orphelins', async () => {
    const mockMapData: TourLinkMap = {
      nodes: [
        { id: 'n1', kind: 'scene', label: 'Scene Orpheline 1', isStart: false, orphan: true },
        { id: 'n2', kind: 'scene', label: 'Scene Orpheline 2', isStart: false, orphan: true },
        { id: 'n3', kind: 'scene', label: 'Scene Non Orpheline', isStart: true, orphan: false }
      ],
      edges: []
    };

    let resolveApi: (value: TourLinkMap) => void = () => {};
    const apiPromise = new Promise<TourLinkMap>((resolve) => {
      resolveApi = resolve;
    });
    vi.mocked(getTourLinkMap).mockReturnValue(apiPromise);

    render(<TourLinkMapPanel tourId="tour1" />);
    
    // Check loading state
    expect(screen.getByText('Chargement...')).toBeDefined();
    
    // Resolve API
    resolveApi(mockMapData);

    // Wait for the graph and orphans to be rendered
    await waitFor(() => {
      expect(screen.getByTestId('link-map-graph')).toBeDefined();
    });

    expect(screen.getByTestId('link-map-graph').getAttribute('data-map')).toBe(JSON.stringify(mockMapData));

    expect(screen.getByText('Scènes orphelines')).toBeDefined();
    expect(screen.getByText('Scene Orpheline 1')).toBeDefined();
    expect(screen.getByText('Scene Orpheline 2')).toBeDefined();
    expect(screen.queryByText('Scene Non Orpheline')).toBeNull();
  });

  it('(b) aucun orphelin -> message noOrphans affiché et pas de liste', async () => {
    const mockMapData: TourLinkMap = {
      nodes: [
        { id: 'n1', kind: 'scene', label: 'Scene 1', isStart: true, orphan: false }
      ],
      edges: []
    };

    vi.mocked(getTourLinkMap).mockResolvedValue(mockMapData);

    render(<TourLinkMapPanel tourId="tour1" />);

    await waitFor(() => {
      expect(screen.getByTestId('link-map-graph')).toBeDefined();
    });

    expect(screen.getByText('Aucune scène orpheline')).toBeDefined();
    expect(screen.queryByText('Scènes orphelines')).toBeNull();
  });

  it('(c) getTourLinkMap rejette -> Alert d\'erreur', async () => {
    vi.mocked(getTourLinkMap).mockRejectedValue(new Error('Network error'));

    render(<TourLinkMapPanel tourId="tour1" />);

    await waitFor(() => {
      expect(screen.getByText('Une erreur est survenue.')).toBeDefined();
    });
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('(d) clic sur le bouton Actualiser -> getTourLinkMap appelé une seconde fois', async () => {
    const mockMapData: TourLinkMap = {
      nodes: [{ id: 'n1', kind: 'scene', label: 'Scene 1', isStart: true, orphan: false }],
      edges: []
    };

    vi.mocked(getTourLinkMap).mockResolvedValue(mockMapData);

    render(<TourLinkMapPanel tourId="tour1" />);

    await waitFor(() => {
      expect(screen.getByTestId('link-map-graph')).toBeDefined();
    });

    expect(getTourLinkMap).toHaveBeenCalledTimes(1);
    expect(getTourLinkMap).toHaveBeenCalledWith('tour1');

    const refreshBtn = screen.getByRole('button', { name: 'Actualiser' });
    fireEvent.click(refreshBtn);

    expect(getTourLinkMap).toHaveBeenCalledTimes(2);
    expect(getTourLinkMap).toHaveBeenNthCalledWith(2, 'tour1');
  });

  it('(e) affiche le message empty si la carte n\'a aucun noeud', async () => {
    const mockMapData: TourLinkMap = {
      nodes: [],
      edges: []
    };

    vi.mocked(getTourLinkMap).mockResolvedValue(mockMapData);

    render(<TourLinkMapPanel tourId="tour1" />);

    await waitFor(() => {
      expect(screen.getByText('Aucune scène dans cette visite.')).toBeDefined();
    });

    expect(screen.queryByTestId('link-map-graph')).toBeNull();
  });
});
