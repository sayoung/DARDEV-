import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from '../i18n.js';
import { HotspotDetailPage } from './HotspotDetailPage.js';
import { navigate, useAppLocation } from '../router.js';
import { useAuth } from '../auth/AuthProvider.js';
import { getScene, createHotspot, listScenes, getTour } from '../api/catalog.js';
import { Role, HotspotType, type SceneResponse, type TourResponse } from '@xplor/shared';
import { ApiError } from '../api/client.js';

vi.mock('../router.js', () => ({
  useAppLocation: vi.fn(),
  navigate: vi.fn(),
  hrefFor: vi.fn((path: string) => path),
}));

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/catalog.js', () => ({
  getScene: vi.fn(),
  getHotspot: vi.fn(),
  createHotspot: vi.fn(),
  updateHotspot: vi.fn(),
  listScenes: vi.fn(),
  listTours: vi.fn(),
  getTour: vi.fn(),
  listAssets: vi.fn(() => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 10 })),
}));

// Mock minimal des Pickers car ils peuvent avoir des requêtes
vi.mock('../catalog/AssetPicker.js', () => ({
  AssetPicker: ({ label, 'data-testid': testId }: { label: string; 'data-testid'?: string }) => <div data-testid={testId || 'asset-picker'}>{label}</div>
}));
vi.mock('../catalog/MultiAssetPicker.js', () => ({
  MultiAssetPicker: ({ label }: { label: string }) => <div>{label}</div>
}));

const mockAuth = {
  state: {
    status: 'authenticated',
    profile: { id: 'u1', name: 'Admin', role: Role.ADMIN, uiLang: 'fr' },
  },
};

const dummyScene = { id: 's1', title: { fr: 'Scene 1' } } as unknown as SceneResponse;
const dummyTour = { id: 't1', title: { fr: 'Tour 1' } } as unknown as TourResponse;
describe('HotspotDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('fr');
    vi.mocked(useAuth).mockReturnValue(mockAuth as never);
    vi.mocked(listScenes).mockResolvedValue([dummyScene]);
    vi.mocked(getScene).mockResolvedValue(dummyScene);
    vi.mocked(getTour).mockResolvedValue(dummyTour);
  });

  afterEach(() => {
    cleanup();
  });

  it('formulaire appelle l\'API', async () => {
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'hotspot-new', tourId: 't1', sceneId: 's1' },
      notice: null,
      search: '',
    } as never);

    vi.mocked(createHotspot).mockResolvedValue({ id: 'h1' } as never);

    render(<HotspotDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Ajouter un hotspot').length).toBeGreaterThan(0);
    });

    const typeSelect = screen.getByLabelText('Type');
    fireEvent.change(typeSelect, { target: { value: HotspotType.URL } });

    const labelInput = document.querySelector<HTMLInputElement>('input[lang="fr"]');
    if (labelInput) fireEvent.change(labelInput, { target: { value: 'Google' } });

    const urlInput = screen.getByLabelText('URL externe');
    fireEvent.change(urlInput, { target: { value: 'https://google.com' } });

    const form = document.querySelector<HTMLFormElement>('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(createHotspot).toHaveBeenCalledWith('s1', expect.objectContaining({
        type: HotspotType.URL,
        label: { fr: 'Google' },
        url: 'https://google.com',
      }));
    });
    
    expect(navigate).toHaveBeenCalledWith('/tours/t1/scenes/s1/hotspots');
  });

  it('affiche 422', async () => {
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'hotspot-new', tourId: 't1', sceneId: 's1' },
      notice: null,
      search: '',
    } as never);

    vi.mocked(createHotspot).mockRejectedValue(new ApiError(422, 'VALIDATION_FAILED'));

    render(<HotspotDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Ajouter un hotspot').length).toBeGreaterThan(0);
    });

    const typeSelect = screen.getByLabelText('Type');
    fireEvent.change(typeSelect, { target: { value: HotspotType.URL } });

    const labelInput = document.querySelector<HTMLInputElement>('input[lang="fr"]');
    if (labelInput) fireEvent.change(labelInput, { target: { value: 'Google' } });

    const urlInput = screen.getByLabelText('URL externe');
    fireEvent.change(urlInput, { target: { value: 'https://google.com' } });

    const form = document.querySelector<HTMLFormElement>('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Veuillez corriger les erreurs dans le formulaire.')).toBeDefined();
    });
  });

  it('affiche le fil d\'Ariane et le bouton de retour avec les bons liens', async () => {
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'hotspot-new', tourId: 't1', sceneId: 's1' },
      notice: null,
      search: '',
    } as never);

    render(<HotspotDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Ajouter un hotspot').length).toBeGreaterThan(0);
    });

    const links = screen.getAllByRole('link');
    const toursLink = links.find(l => l.getAttribute('href') === '/tours');
    const tourLink = links.find(l => l.getAttribute('href') === '/tours/t1');
    const sceneLink = links.find(l => l.getAttribute('href') === '/tours/t1/scenes/s1');
    
    expect(toursLink).toBeDefined();
    expect(tourLink).toBeDefined();
    expect(sceneLink).toBeDefined();
    
    // Le bouton de retour a href vers /tours/t1 et contient le texte retour
    const backBtn = screen.getByText('← Retour à la visite');
    expect(backBtn.closest('a')?.getAttribute('href')).toBe('/tours/t1');
  });

  it('affiche le formulaire et le lien de retour même si getTour rejette', async () => {
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'hotspot-new', tourId: 't1', sceneId: 's1' },
      notice: null,
      search: '',
    } as never);

    vi.mocked(getTour).mockRejectedValueOnce(new Error('Erreur API'));

    render(<HotspotDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Ajouter un hotspot').length).toBeGreaterThan(0);
    });

    const backBtn = screen.getByText('← Retour à la visite');
    expect(backBtn.closest('a')?.getAttribute('href')).toBe('/tours/t1');
  });
});
