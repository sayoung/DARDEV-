/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TourScenesSection } from './TourScenesSection.js';
import { TourStatus, type TourResponse } from '@xplor/shared';

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

const mockScenes = [
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

  it('la création envoie le bon corps', async () => {
    render(<TourScenesSection tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
    
    // Remplir Assets
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        items: [{
          id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99',
          kind: 'PANORAMA',
          mimeType: 'image/jpeg',
          sizeBytes: 1234,
          width: 2000,
          height: 1000,
          processingStatus: 'READY',
          
          copyright: null
        }],
        total: 1,
        page: 1,
        pageSize: 100
      })
    });
    
    fireEvent.click(screen.getByText('catalog.scene.actions.add'));
    
    const titleInputs = screen.getAllByRole('textbox');
    fireEvent.change(titleInputs[0]!, { target: { value: 'Nouvelle Scène' } });
    
    // Attendre que l'AssetPicker charge
    await waitFor(() => {
      const s = document.querySelector('select');
      expect(s).not.toBeNull();
      expect(s?.options.length).toBeGreaterThan(0);
    });
    const select = document.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99' } });

    // Mocker la réponse POST
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ...mockScenes[0], id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d00' })
    });
    // Mocker le rechargement de la liste
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [...mockScenes, { ...mockScenes[0], id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d00' }]
    });

    fireEvent.click(screen.getByText('common.save'));
    
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(c => c[0] === `/api/v1/admin/tours/${mockTour.id}/scenes` && c[1]?.method === 'POST');
      expect(call).toBeDefined();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.title.fr).toBe('Nouvelle Scène');
      expect(body.panoramaAssetId).toBe('018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99');
      expect(body.weight).toBe(2);
    });
  });

  it('Descendre envoie l\'ordre attendu', async () => {
    render(<TourScenesSection tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
    
    // Le premier bouton "Descendre"
    const moveDownButtons = screen.getAllByText('catalog.scene.actions.moveDown');
    expect(moveDownButtons[0]!.hasAttribute('disabled')).toBe(false);
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([mockScenes[1], mockScenes[0]])
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([mockScenes[1], mockScenes[0]])
    });

    fireEvent.click(moveDownButtons[0]!);
    
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(c => typeof c[0] === 'string' && c[0].includes('/reorder'));
      expect(call).toBeDefined();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ sceneIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e', '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c'] });
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
    fireEvent.click(setStartButtons[1]!);
    
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(c => c[0] === `/api/v1/admin/tours/${mockTour.id}/scenes/set-start`);
      expect(call).toBeDefined();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ sceneId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e' });
      expect(onTourUpdated).toHaveBeenCalledWith(expect.objectContaining({ startSceneId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e' }));
    });
  });

  it('la suppression confirmée envoie DELETE', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(<TourScenesSection tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([mockScenes[1]])
    });
    
    const deleteButtons = screen.getAllByText('common.delete');
    fireEvent.click(deleteButtons[0]!);
    
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(c => c[0] === `/api/v1/admin/scenes/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c` && c[1]?.method === 'DELETE');
      expect(call).toBeDefined();
    });
    
    confirmSpy.mockRestore();
  });
});
