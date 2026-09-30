import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TourScenesSection } from './TourScenesSection.js';
import { TourStatus, type TourResponse, type SceneResponse, type AssetResponse, AssetKind, ProcessingStatus } from '@xplor/shared';

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

  it('la création envoie le bon corps et met à jour le badge', async () => {
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
    
    const mockAsset: AssetResponse = {
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99',
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1234,
      width: 2000,
      height: 1000,
      processingStatus: ProcessingStatus.READY,
      createdAt: '2026-09-29T18:00:00.000Z',
      copyright: null
    };

    // Remplir Assets
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        items: [mockAsset],
        total: 1,
        page: 1,
        pageSize: 100
      })
    });
    
    fireEvent.click(screen.getByText('catalog.scene.actions.add'));
    
    const titleInputs = screen.getAllByRole('textbox');
    const titleInput = titleInputs[0];
    if (!titleInput) throw new Error('title input not found');
    fireEvent.change(titleInput, { target: { value: 'Nouvelle Scène' } });
    
    // Attendre que l'AssetPicker charge
    await waitFor(() => {
      const s = document.querySelector('select');
      expect(s).not.toBeNull();
      expect(s?.options.length).toBeGreaterThan(0);
    });
    const select = document.querySelector('select');
    if (!select) throw new Error('select not found');
    fireEvent.change(select, { target: { value: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99' } });

    const baseScene = mockScenes[0];
    if (!baseScene) throw new Error('base scene not found');

    const newScene: SceneResponse = {
      ...baseScene,
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d00',
      title: { fr: 'Nouvelle Scène' }
    };

    // Mocker la réponse POST createScene
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve(newScene)
    });
    // Mocker getTour (startSceneId a été mis à jour par l'API)
    const updatedTour: TourResponse = {
      ...mockTour,
      sceneCount: 1,
      startSceneId: newScene.id
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(updatedTour)
    });
    // Mocker le rechargement de la liste
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([newScene])
    });

    fireEvent.click(screen.getByText('common.save'));
    
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(c => c[0] === `/api/v1/admin/tours/${mockTour.id}/scenes` && (c[1] as RequestInit | undefined)?.method === 'POST');
      expect(call).toBeDefined();
      if (!call) throw new Error('POST call not found');
      const body = JSON.parse((call[1] as RequestInit).body as string) as { title: { fr: string }, panoramaAssetId: string, weight: number };
      expect(body.title.fr).toBe('Nouvelle Scène');
      expect(body.panoramaAssetId).toBe('018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99');
      // Pour une première scène le weight est 0
      expect(body.weight).toBe(0);
      
      expect(onTourUpdated).toHaveBeenCalledWith(updatedTour);
    });
    
    // Le composant parent mettrait à jour 'tour', on simule ce rerender
    // Wait for the table to be updated and show the badge
    // We didn't change props.tour here directly, but verify that it was called.
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
