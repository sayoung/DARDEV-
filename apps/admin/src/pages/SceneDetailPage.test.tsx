import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from '../i18n.js';
import { SceneDetailPage } from './SceneDetailPage.js';
import { navigate, useAppLocation } from '../router.js';
import { useAuth } from '../auth/AuthProvider.js';
import { getScene, createScene, listScenes, getAsset, listHotspots } from '../api/catalog.js';
import { Role, type SceneResponse, type AssetResponse, AssetKind, ProcessingStatus, type HotspotResponse, HotspotType, HotspotIcon } from '@xplor/shared';
import { SceneEditor360 } from '../components/SceneEditor360.js';

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
  createScene: vi.fn(),
  updateScene: vi.fn(),
  listScenes: vi.fn(),
  getAsset: vi.fn(),
  listHotspots: vi.fn(),
  listAssets: vi.fn(() => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 10 })),
}));

vi.mock('../components/SceneEditor360.js', () => ({
  SceneEditor360: vi.fn(() => <div data-testid="mock-scene-editor" />),
}));

interface MockAssetPickerProps {
  kind: string;
  value: string;
  onChange: (val: string) => void;
}

vi.mock('../catalog/AssetPicker.js', () => ({
  AssetPicker: (props: MockAssetPickerProps) => (
    <input
      data-testid={`mock-asset-picker-${props.kind}`}
      value={props.value || ''}
      onChange={(e) => { props.onChange(e.target.value); }}
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
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
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
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 'new' },
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
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 'new' },
      notice: null,
      search: '',
    });
    vi.mocked(listScenes).mockResolvedValue([]);
    const mockSceneResponse: SceneResponse = {
      id: 's-new',
      tourId: 't-1',
      title: { fr: 'Titre' },
      panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
      weight: 0,
      hotspotCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(createScene).mockResolvedValue(mockSceneResponse);

    const { container } = render(<SceneDetailPage />);

    await screen.findByTestId('submit-scene-btn');

    // Fill title
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Nouvelle scène' } });

    // Fill panorama with valid UUID
    const panoramaInput = screen.getByTestId('mock-asset-picker-PANORAMA');
    fireEvent.change(panoramaInput, { target: { value: '018b1d62-a5e3-7a91-9e23-2834b6b63300' } });

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

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
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 'new' },
      notice: null,
      search: '',
    });
    vi.mocked(listScenes).mockResolvedValue([]);

    const { container } = render(<SceneDetailPage />);

    await screen.findByTestId('submit-scene-btn');

    // Fill title to bypass LocalizedTextField's block, leaving panorama empty to trigger Zod error
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Nouvelle scène' } });

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(await screen.findByText('Veuillez corriger les erreurs dans le formulaire.')).toBeDefined();
  });

  it('opens Editor 360 tab with READY asset and passes hotspots', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1',
      tourId: 't-1',
      title: { fr: 'Titre' },
      panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 10,
      initialPitch: -5,
      initialZoom: 50,
      weight: 0,
      hotspotCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);

    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      width: 4000,
      height: 2000,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {
        preview: 'mock.jpg',
        web: 'mock.jpg',
        thumb: 'mock.jpg',
        tilesPrefix: 'mock/',
        tileGrid: { cols: 4, rows: 2, size: 512 },
      },
      panorama: null,
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);

    const mockHotspots: HotspotResponse[] = [
      {
        id: 'h-1',
        sceneId: 's-1',
        type: HotspotType.INFO,
        yaw: 0,
        pitch: 0,
        label: { fr: 'Info' },
        targetSceneId: null,
        targetTourId: null,
        targetTourSceneId: null,
        body: { fr: 'Details' },
        url: null,
        arrivalYaw: null,
        mediaAssetIds: [],
        icon: HotspotIcon.INFO,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    vi.mocked(listHotspots).mockResolvedValue(mockHotspots);

    render(<SceneDetailPage />);

    // Wait for the scene to load and tabs to be visible
    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    await waitFor(() => {
      expect(SceneEditor360).toHaveBeenCalledWith(
        expect.objectContaining({
          initialView: { yaw: 10, pitch: -5, zoom: 50 },
          hotspots: [
            {
              id: 'h-1',
              position: { yaw: 0, pitch: 0 },
              tooltip: 'Info',
              className: 'xplor-marker xplor-marker-info',
            }
          ],
        }),
        undefined
      );
    });
  });

  it('displays alert when asset is not READY in Editor 360 tab', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1',
      tourId: 't-1',
      title: { fr: 'Titre' },
      panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
      weight: 0,
      hotspotCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);

    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      width: null,
      height: null,
      processingStatus: ProcessingStatus.PROCESSING,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);
    vi.mocked(listHotspots).mockResolvedValue([]);

    render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    expect(await screen.findByText("Le panorama n'est pas prêt.")).toBeDefined();
  });
});
