import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { TourLinkMapPanel } from './TourLinkMapPanel.js';

// Mock pour useTranslation
const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockTourId = 't_123';

describe('TourLinkMapPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche le chargement puis les données sans erreurs et sans orphelins', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ nodes: [], edges: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<TourLinkMapPanel tourId={mockTourId} />);

    expect(screen.getByText('catalog.tours.linkMap.title')).toBeDefined();
    expect(screen.getByText('common.loading')).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).toBeNull();
    });

    expect(screen.getByTestId('link-map-graph')).toBeDefined();
    expect(screen.getByText('catalog.tours.linkMap.noOrphans')).toBeDefined();
    expect(screen.queryByText('catalog.tours.linkMap.orphans')).toBeNull();
  });

  it('affiche une erreur en cas d\'échec de l\'API', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<TourLinkMapPanel tourId={mockTourId} />);

    await waitFor(() => {
      expect(screen.getByText('common.error.generic')).toBeDefined();
    });
    
    expect(screen.queryByTestId('link-map-graph')).toBeNull();
  });

  it('affiche la liste des orphelins si la carte contient des scènes orphelines', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          nodes: [
            { id: 'n1', kind: 'scene', label: 'Scene Orpheline 1', isStart: false, orphan: true },
            { id: 'n2', kind: 'scene', label: 'Scene Liée', isStart: true, orphan: false },
            { id: 'n3', kind: 'external', label: 'Ext', isStart: false, orphan: true }, // external ne doit pas être compté
          ],
          edges: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    render(<TourLinkMapPanel tourId={mockTourId} />);

    await waitFor(() => {
      expect(screen.getByText('catalog.tours.linkMap.orphans')).toBeDefined();
    });

    expect(screen.getByText('Scene Orpheline 1')).toBeDefined();
    expect(screen.queryByText('Scene Liée')).toBeNull();
    expect(screen.queryByText('Ext')).toBeNull();
  });

  it('le bouton actualiser relance le chargement', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ nodes: [], edges: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<TourLinkMapPanel tourId={mockTourId} />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).toBeNull();
    });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ nodes: [], edges: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const refreshBtn = screen.getByRole('button', { name: 'catalog.tours.linkMap.refresh' });
    fireEvent.click(refreshBtn);

    expect(screen.getByText('common.loading')).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).toBeNull();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
