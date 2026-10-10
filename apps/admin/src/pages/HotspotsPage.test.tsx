import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from '../i18n.js';
import { HotspotsPage } from './HotspotsPage.js';
import { navigate, useAppLocation } from '../router.js';
import { useAuth } from '../auth/AuthProvider.js';
import { getScene, getTour, listHotspots, listScenes, deleteHotspot } from '../api/catalog.js';
import { Role, HotspotType, HotspotIcon, TourStatus, type HotspotResponse, type SceneResponse, type TourResponse } from '@xplor/shared';

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
  getTour: vi.fn(),
  listScenes: vi.fn(),
  listHotspots: vi.fn(),
  deleteHotspot: vi.fn(),
}));

const mockAuth = {
  state: {
    status: 'authenticated',
    profile: { id: 'u1', name: 'Admin', role: Role.ADMIN, uiLang: 'fr' },
  },
};

const dummyTour = { id: 't1', title: { fr: 'Tour 1' }, status: TourStatus.DRAFT } as unknown as TourResponse;
const dummyScene = { id: 's1', title: { fr: 'Scene 1' } } as unknown as SceneResponse;
const dummyHotspot = { id: 'h1', type: HotspotType.INFO, label: { fr: 'Mon hotspot' }, icon: HotspotIcon.INFO } as unknown as HotspotResponse;
describe('HotspotsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('fr');
    vi.mocked(useAuth).mockReturnValue(mockAuth as never);
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'hotspots', tourId: 't1', sceneId: 's1' },
      notice: null,
      search: '',
    } as never);

    vi.mocked(getTour).mockResolvedValue(dummyTour);
    vi.mocked(getScene).mockResolvedValue(dummyScene);
    vi.mocked(listScenes).mockResolvedValue([dummyScene]);
    vi.mocked(listHotspots).mockResolvedValue([dummyHotspot]);
  });

  afterEach(() => {
    cleanup();
  });

  it('liste affiche les hotspots', async () => {
    render(<HotspotsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mon hotspot')).toBeDefined();
    });

    expect(screen.getByText('Information')).toBeDefined(); // Type info traduit
  });

  it('navigue vers la modification', async () => {
    render(<HotspotsPage />);
    await waitFor(() => {
      expect(screen.getByText('Mon hotspot')).toBeDefined();
    });

    const editBtns = screen.getAllByRole('button', { name: 'Modifier' });
    if (editBtns[0]) fireEvent.click(editBtns[0]);
    expect(navigate).toHaveBeenCalledWith('/tours/t1/scenes/s1/hotspots/h1');
  });

  it('supprime un hotspot', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteHotspot).mockResolvedValue(undefined);

    render(<HotspotsPage />);
    await waitFor(() => {
      expect(screen.getByText('Mon hotspot')).toBeDefined();
    });

    const deleteBtns = screen.getAllByRole('button', { name: 'Supprimer' });
    if (deleteBtns[0]) fireEvent.click(deleteBtns[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteHotspot).toHaveBeenCalledWith('h1');

    await waitFor(() => {
      expect(screen.queryByText('Mon hotspot')).toBeNull();
    });
  });

  it('affiche le fil d\'Ariane avec les bons liens', async () => {
    render(<HotspotsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mon hotspot')).toBeDefined();
    });

    const links = screen.getAllByRole('link');
    const toursLink = links.find(l => l.getAttribute('href') === '/tours');
    const tourLink = links.find(l => l.getAttribute('href') === '/tours/t1');
    const sceneLink = links.find(l => l.getAttribute('href') === '/tours/t1/scenes/s1');
    
    expect(toursLink).toBeDefined();
    expect(tourLink).toBeDefined();
    expect(sceneLink).toBeDefined();
  });
});
