import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TourScenesSection } from './TourScenesSection.js';
import { TourStatus, type TourResponse, type SceneResponse } from '@xplor/shared';

import { navigate } from '../router.js';

vi.mock('../router.js', () => ({
  navigate: vi.fn(),
  hrefFor: vi.fn((path: string) => path),
}));

// Mock du client HTTP global
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' }
  })
}));

const mockTour: TourResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9a',
  status: TourStatus.DRAFT,
  title: { fr: 'Visite test' },
  summary: { fr: 'Summary test' },
  categoryIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99'],
  cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9b',
  coverAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d98',
  startSceneId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c',
  sceneCount: 2,
  publicShare: false,
  shareToken: '1234567890123456789012',
  createdById: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d90',
  publishedAt: null,
  contentVersion: 1
};

const mockScenes: SceneResponse[] = [
  {
    id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c',
    tourId: mockTour.id,
    title: { fr: 'Scène A' },
    panoramaAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9d',
    initialYaw: 0,
    initialPitch: 0,
    initialZoom: 50,
    weight: 0,
    hotspotCount: 0,
    createdAt: '2026-09-29T18:00:00.000Z',
    updatedAt: '2026-09-29T18:00:00.000Z'
  },
  {
    id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e',
    tourId: mockTour.id,
    title: { fr: 'Scène B' },
    panoramaAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f',
    initialYaw: 0,
    initialPitch: 0,
    initialZoom: 60,
    weight: 1,
    hotspotCount: 2,
    createdAt: '2026-09-29T18:00:00.000Z',
    updatedAt: '2026-09-29T18:00:00.000Z'
  }
];

describe('TourScenesSection', () => {
  const onTourUpdated = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockScenes),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('affiche la liste avec le badge de départ', async () => {
    render(<TourScenesSection tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
    
    expect(screen.getByText('catalog.scene.startBadge')).toBeDefined();
  });

  it('le bouton ajouter redirige vers le formulaire de création', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });
    render(<TourScenesSection tour={{...mockTour, sceneCount: 0, startSceneId: null}} onTourUpdated={onTourUpdated} />);
    
    // Attendre le rechargement initial (vide)
    await waitFor(() => {
      expect(screen.getByText('catalog.scene.actions.add')).toBeDefined();
    });
    
    const addBtn = screen.getByText('catalog.scene.actions.add');
    fireEvent.click(addBtn);
    expect(navigate).toHaveBeenCalledWith(`/tours/${mockTour.id}/scenes/new`);
  });

  it('Descendre envoie l\'ordre attendu', async () => {
    render(<TourScenesSection tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
    
    // Le premier bouton "Descendre"
    const moveDownButtons = screen.getAllByText('catalog.scene.actions.moveDown');
    const moveBtn = moveDownButtons[0];
    if (!moveBtn) throw new Error('btn not found');
    expect(moveBtn.hasAttribute('disabled')).toBe(false);
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockScenes[1], mockScenes[0]])
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockScenes[1], mockScenes[0]])
    });

    fireEvent.click(moveBtn);
    
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(c => typeof c[0] === 'string' && c[0].includes('/reorder'));
      expect(call).toBeDefined();
      if (!call) throw new Error('reorder call not found');
      const body = JSON.parse((call[1] as RequestInit).body as string) as { sceneIds: string[] };
      expect(body).toEqual({ sceneIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e', '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c'] });
    });
  });

  it('set-start envoie le bon sceneId', async () => {
    render(<TourScenesSection tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockTour, startSceneId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e' })
    });
    
    const setStartButtons = screen.getAllByText('catalog.scene.actions.setStart');
    const setStartBtn = setStartButtons[1];
    if (!setStartBtn) throw new Error('btn not found');
    fireEvent.click(setStartBtn);
    
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(c => c[0] === `/api/v1/admin/tours/${mockTour.id}/scenes/set-start`);
      expect(call).toBeDefined();
      if (!call) throw new Error('set start call not found');
      const body = JSON.parse((call[1] as RequestInit).body as string) as { sceneId: string };
      expect(body).toEqual({ sceneId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e' });
      expect(onTourUpdated).toHaveBeenCalledWith(expect.objectContaining({ startSceneId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e' }));
    });
  });

  it('la suppression confirmée envoie DELETE', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(<TourScenesSection tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
    
    // DELETE scene
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204
    });
    // reloadScenes
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockScenes[1]])
    });
    // getTour
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockTour, sceneCount: 1 })
    });
    
    const deleteButtons = screen.getAllByText('common.delete');
    const deleteBtn = deleteButtons[0];
    if (!deleteBtn) throw new Error('btn not found');
    fireEvent.click(deleteBtn);
    
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(c => c[0] === `/api/v1/admin/scenes/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c` && (c[1] as RequestInit | undefined)?.method === 'DELETE');
      expect(call).toBeDefined();
    });
    
    confirmSpy.mockRestore();
  });
});
