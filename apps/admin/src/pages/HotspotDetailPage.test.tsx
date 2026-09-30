import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from '../i18n.js';
import { HotspotDetailPage } from './HotspotDetailPage.js';
import { navigate, useAppLocation } from '../router.js';
import { useAuth } from '../auth/AuthProvider.js';
import { getScene, getHotspot, createHotspot, listScenes, listTours } from '../api/catalog.js';
import { Role, HotspotType, HotspotIcon, type HotspotResponse, type SceneResponse } from '@xplor/shared';
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
  listAssets: vi.fn(() => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 10 })),
}));

// Mock minimal des Pickers car ils peuvent avoir des requêtes
vi.mock('../catalog/AssetPicker.js', () => ({
  AssetPicker: ({ label, 'data-testid': testId }: any) => <div data-testid={testId || 'asset-picker'}>{label}</div>
}));
vi.mock('../catalog/MultiAssetPicker.js', () => ({
  MultiAssetPicker: ({ label }: any) => <div>{label}</div>
}));

const mockAuth = {
  state: {
    status: 'authenticated',
    profile: { id: 'u1', name: 'Admin', role: Role.ADMIN, uiLang: 'fr' },
  },
};

const dummyScene = { id: 's1', title: { fr: 'Scene 1' } } as unknown as SceneResponse;
describe('HotspotDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('fr');
    vi.mocked(useAuth).mockReturnValue(mockAuth as never);
    vi.mocked(listScenes).mockResolvedValue([dummyScene]);
    vi.mocked(getScene).mockResolvedValue(dummyScene);
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
      expect(screen.getByText('Ajouter un hotspot')).toBeDefined();
    });

    const typeSelect = screen.getByLabelText('Type');
    fireEvent.change(typeSelect, { target: { value: HotspotType.URL } });

    const labelInput = document.querySelector('input[lang="fr"]')! as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'Google' } });

    const urlInput = screen.getByLabelText('URL externe');
    fireEvent.change(urlInput, { target: { value: 'https://google.com' } });

    const form = document.querySelector('form')! as HTMLFormElement;
    fireEvent.submit(form);

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
      expect(screen.getByText('Ajouter un hotspot')).toBeDefined();
    });

    const typeSelect = screen.getByLabelText('Type');
    fireEvent.change(typeSelect, { target: { value: HotspotType.URL } });

    const labelInput = document.querySelector('input[lang="fr"]')! as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'Google' } });

    const urlInput = screen.getByLabelText('URL externe');
    fireEvent.change(urlInput, { target: { value: 'https://google.com' } });

    const form = document.querySelector('form')! as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Veuillez corriger les erreurs dans le formulaire.')).toBeDefined();
    });
  });
});
