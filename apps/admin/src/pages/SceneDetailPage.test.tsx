import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resources } from '@xplor/i18n';
import { i18n } from '../i18n.js';
import { SceneDetailPage } from './SceneDetailPage.js';
import { AppRoute, navigate, useAppLocation } from '../router.js';
import { useAuth } from '../auth/AuthProvider.js';
import { getScene, createScene, updateScene, listScenes, listAssets } from '../api/catalog.js';
import { Role } from '@xplor/shared';

vi.mock('../router.js', () => ({
  useAppLocation: vi.fn(),
  navigate: vi.fn(),
  hrefFor: vi.fn((path) => path),
}));

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/catalog.js', () => ({
  getScene: vi.fn(),
  createScene: vi.fn(),
  updateScene: vi.fn(),
  listScenes: vi.fn(),
  listAssets: vi.fn(() => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 10 })),
}));

vi.mock('../catalog/AssetPicker.js', () => ({
  AssetPicker: (props: any) => (
    <input 
      data-testid={`mock-asset-picker-${props.kind}`}
      value={props.value || ''} 
      onChange={(e) => props.onChange(e.target.value)} 
    />
  )
}));

const mockAuth = (role = Role.ADMIN) => {
  vi.mocked(useAuth).mockReturnValue({
    state: {
      status: 'authenticated',
      profile: {
        id: 'u-1',
        email: 'admin@local',
        name: 'Admin',
        role,
        uiLang: 'fr',
        csrfToken: 'token',
      },
    },
    login: vi.fn(),
    logout: vi.fn(),
  });
};

describe('SceneDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading initially', () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' } as AppRoute,
      notice: null,
      search: '',
    });
    vi.mocked(getScene).mockImplementation(() => new Promise(() => {}));

    render(<SceneDetailPage />);
    expect(screen.getByText('Chargement...')).toBeDefined();
  });

  it('displays form fields for new scene', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 'new' } as AppRoute,
      notice: null,
      search: '',
    });
    vi.mocked(listScenes).mockResolvedValue([]);

    render(<SceneDetailPage />);
    
    const submitBtn = await screen.findByTestId('submit-scene-btn');
    expect(submitBtn).toBeDefined();
  });

  it('submits form successfully', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 'new' } as AppRoute,
      notice: null,
      search: '',
    });
    vi.mocked(listScenes).mockResolvedValue([]);
    vi.mocked(createScene).mockResolvedValue({ id: 's-new', title: { fr: 'Titre' } } as any);

    const { container } = render(<SceneDetailPage />);
    
    await screen.findByTestId('submit-scene-btn');

    // Fill title
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Nouvelle scène' } });
    
    // Fill panorama with valid UUID
    const panoramaInput = screen.getByTestId('mock-asset-picker-PANORAMA');
    fireEvent.change(panoramaInput, { target: { value: '018b1d62-a5e3-7a91-9e23-2834b6b63300' } });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(createScene).toHaveBeenCalledWith('t-1', expect.objectContaining({
        title: { fr: 'Nouvelle scène' },
        panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
        initialYaw: 0,
        initialPitch: 0,
        initialZoom: 50,
        weight: 0,
      }));
    });

    expect(navigate).toHaveBeenCalledWith('/tours/t-1/scenes/s-new');
  });

  it('displays validation error', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 'new' } as AppRoute,
      notice: null,
      search: '',
    });
    vi.mocked(listScenes).mockResolvedValue([]);

    const { container } = render(<SceneDetailPage />);
    
    await screen.findByTestId('submit-scene-btn');
    
    // Fill title to bypass LocalizedTextField's block, leaving panorama empty to trigger Zod error
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Nouvelle scène' } });

    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText('Veuillez corriger les erreurs dans le formulaire.')).toBeDefined();
  });
});
