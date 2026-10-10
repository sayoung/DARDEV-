import { render, screen, waitFor, fireEvent, cleanup, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from '../i18n.js';
import { SceneDetailPage } from './SceneDetailPage.js';
import { navigate, useAppLocation } from '../router.js';
import { useAuth } from '../auth/AuthProvider.js';
import { getScene, createScene, updateScene, listScenes, getAsset, listAssets, listHotspots, createHotspot, updateHotspot, deleteHotspot, getTour } from '../api/catalog.js';
import { Role, type SceneResponse, type AssetResponse, AssetKind, ProcessingStatus, type HotspotResponse, HotspotType, HotspotIcon, type TourResponse } from '@xplor/shared';
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
  getTour: vi.fn(),
  getScene: vi.fn(),
  createScene: vi.fn(),
  updateScene: vi.fn(),
  listScenes: vi.fn(),
  getAsset: vi.fn(),
  listHotspots: vi.fn(),
  createHotspot: vi.fn(),
  updateHotspot: vi.fn(),
  deleteHotspot: vi.fn(),
  listAssets: vi.fn(() => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 10 })),
}));

vi.mock('../components/SceneEditor360.js', () => ({
  SceneEditor360: vi.fn(({ onPanoramaClick, onMarkerSelect, onMarkerMove, handleRef }: { onPanoramaClick?: (yaw: number, pitch: number) => void, onMarkerSelect?: (id: string) => void, onMarkerMove?: (id: string, yaw: number, pitch: number) => void, handleRef?: React.Ref<{ getView: () => { yaw: number, pitch: number, zoom: number } }> }) => {
    if (handleRef) {
      if (typeof handleRef === 'function') {
        handleRef({ getView: () => ({ yaw: 0.5, pitch: -0.2, zoom: 40 }) });
      } else if ('current' in handleRef) {
        (handleRef as React.RefObject<{ getView: () => { yaw: number, pitch: number, zoom: number } }>).current = { getView: () => ({ yaw: 0.5, pitch: -0.2, zoom: 40 }) };
      }
    }
    return (
      <div data-testid="mock-scene-editor">
        <button 
          data-testid="mock-panorama-click" 
          onClick={() => onPanoramaClick?.(0.5, 0.1)}
        >
          Simulate click
        </button>
        <button 
          data-testid="mock-marker-select" 
          onClick={() => onMarkerSelect?.('h-1')}
        >
          Simulate marker select
        </button>
        <button 
          data-testid="mock-marker-move" 
          onClick={() => onMarkerMove?.('h-1', 1.2, 0.3)}
        >
          Simulate marker move
        </button>
      </div>
    );
  }),
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

vi.mock('./ArrivalOrientationDialog.js', () => ({
  ArrivalOrientationDialog: vi.fn(({ open, onConfirm, onClose }: { open: boolean, onConfirm: (y: number) => void, onClose: () => void }) => {
    if (!open) return null;
    return (
      <div data-testid="mock-arrival-dialog">
        <button onClick={() => { onConfirm(1.25); }}>Confirm mock arrival</button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  })
}));

describe('SceneDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('fr');
    vi.mocked(getTour).mockResolvedValue({
      id: 't-1',
      title: { fr: 'Visite de test' },
      description: null,
      status: 'DRAFT',
      category: null,
      city: null,
      location: null,
      thumbnailAssetId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as TourResponse);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders loading initially', () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });
    vi.mocked(getScene).mockImplementation(() => new Promise(() => {}));
    vi.mocked(listScenes).mockImplementation(() => new Promise(() => {}));

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
    vi.mocked(listAssets).mockResolvedValue({
      items: [
        {
          id: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
          filename: 'mock.jpg',
          kind: AssetKind.PANORAMA,
          mimeType: 'image/jpeg',
          sizeBytes: 100,
          width: 800,
          height: 600,
          processingStatus: ProcessingStatus.READY,
          processingLog: null,
          copyright: null,
          thumbnailUrl: null,
          derivatives: {},
          panorama: null,
          createdAt: new Date().toISOString(),
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    });
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

    // Fill panorama
    const panoramaBtn = screen.getByLabelText(/Panorama/i);
    fireEvent.click(panoramaBtn);
    
    const radio = await screen.findByRole('radio', { name: /mock\.jpg/i });
    fireEvent.click(radio);

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
      filename: 'mock.jpg',
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      width: 4000,
      height: 2000,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: {
        preview: 'mock.jpg',
        web: 'mock.jpg',
        tiles: { width: 2048, cols: 4, rows: 2, baseUrl: 'mock/tiles/{col}_{row}.jpg' },
      },
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
      filename: 'mock.jpg',
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

  it('displays hint initially and shows form with yaw/pitch on click', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([{ ...mockSceneResponse, id: 's-2', title: { fr: 'Scene 2' } }]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);
    vi.mocked(listHotspots).mockResolvedValue([]);

    const { container } = render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    expect(await screen.findByText('Cliquez sur le panorama pour placer un hotspot.')).toBeDefined();

    const simBtn = await screen.findByTestId('mock-panorama-click');
    fireEvent.click(simBtn);

    expect(await screen.findByText('Nouveau hotspot')).toBeDefined();
    
    const yawInput = container.querySelector('#yaw') as HTMLInputElement;
    const pitchInput = container.querySelector('#pitch') as HTMLInputElement;
    expect(yawInput.value).toBe('0.5');
    expect(pitchInput.value).toBe('0.1');
  });

  it('submits hotspot form and refreshes list', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([{ ...mockSceneResponse, id: 's-2', title: { fr: 'Scene 2' } }]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);
    
    const mockHotspotResponse: HotspotResponse = {
      id: 'h-1',
      sceneId: 's-1',
      type: HotspotType.SCENE_LINK,
      yaw: 0.5,
      pitch: 0.1,
      label: { fr: 'Nouveau point' },
      targetSceneId: 's-2',
      targetTourId: null,
      targetTourSceneId: null,
      body: null,
      url: null,
      arrivalYaw: null,
      mediaAssetIds: [],
      icon: HotspotIcon.ARROW,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(listHotspots).mockResolvedValueOnce([]).mockResolvedValueOnce([mockHotspotResponse]);
    vi.mocked(createHotspot).mockResolvedValue(mockHotspotResponse);

    const { container } = render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    await screen.findByText('Cliquez sur le panorama pour placer un hotspot.');

    const simBtn = await screen.findByTestId('mock-panorama-click');
    fireEvent.click(simBtn);

    await screen.findByText('Nouveau hotspot');

    const labelInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'Nouveau point' } });

    const targetSceneSelect = container.querySelector('#targetSceneId') as HTMLSelectElement;
    fireEvent.change(targetSceneSelect, { target: { value: 's-2' } });

    const submitBtn = await screen.findByTestId('submit-hotspot-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createHotspot).toHaveBeenCalledWith('s-1', expect.objectContaining({
        type: HotspotType.SCENE_LINK,
        yaw: 0.5,
        pitch: 0.1,
        label: { fr: 'Nouveau point' },
        targetSceneId: 's-2',
      }));
    });

    expect(listHotspots).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(SceneEditor360).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hotspots: [{
            id: 'h-1',
            position: { yaw: 0.5, pitch: 0.1 },
            tooltip: 'Nouveau point',
            className: 'xplor-marker xplor-marker-scene-link'
          }]
        }),
        undefined
      );
    });
  });

  it('cancels hotspot creation and shows hint', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);
    vi.mocked(listHotspots).mockResolvedValue([]);

    render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    const simBtn = await screen.findByTestId('mock-panorama-click');
    fireEvent.click(simBtn);

    await screen.findByText('Nouveau hotspot');

    const cancelBtns = await screen.findAllByText('Annuler');
    const cancelBtn = cancelBtns.find(b => !b.hasAttribute('disabled'));
    if (!cancelBtn) throw new Error("Cancel button not found");
    fireEvent.click(cancelBtn);

    expect(await screen.findByText('Cliquez sur le panorama pour placer un hotspot.')).toBeDefined();
  });

  it('deletes hotspot successfully after confirmation', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);

    const mockHotspotResponse: HotspotResponse = {
      id: 'h-1',
      sceneId: 's-1',
      type: HotspotType.INFO,
      yaw: 0,
      pitch: 0,
      label: { fr: 'Mon hotspot' },
      targetSceneId: null,
      targetTourId: null,
      targetTourSceneId: null,
      body: { fr: 'Body' },
      url: null,
      arrivalYaw: null,
      mediaAssetIds: [],
      icon: HotspotIcon.INFO,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(listHotspots).mockResolvedValue([mockHotspotResponse]);
    vi.mocked(deleteHotspot).mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    // Attendre que listHotspots soit appelé et que le panneau affiche le hint
    await screen.findByText('Cliquez sur le panorama pour placer un hotspot.');

    const simBtn = await screen.findByTestId('mock-marker-select');
    fireEvent.click(simBtn);

    // Le libellé du hotspot (tooltip) devrait s'afficher
    expect(await screen.findByText('Mon hotspot')).toBeDefined();

    const deleteBtn = await screen.findByText('Supprimer');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith('Supprimer ce hotspot ?');
    expect(deleteHotspot).toHaveBeenCalledWith('h-1');

    await waitFor(() => {
      expect(listHotspots).toHaveBeenCalledTimes(2); // une fois au chargement, une fois après suppression
    });

    // Le panneau devrait repasser au hint car la sélection a été vidée
    expect(await screen.findByText('Cliquez sur le panorama pour placer un hotspot.')).toBeDefined();
  });

  it('cancels hotspot deletion if confirmation is refused', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);

    const mockHotspotResponse: HotspotResponse = {
      id: 'h-1',
      sceneId: 's-1',
      type: HotspotType.INFO,
      yaw: 0,
      pitch: 0,
      label: { fr: 'Mon hotspot' },
      targetSceneId: null,
      targetTourId: null,
      targetTourSceneId: null,
      body: { fr: 'Body' },
      url: null,
      arrivalYaw: null,
      mediaAssetIds: [],
      icon: HotspotIcon.INFO,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(listHotspots).mockResolvedValue([mockHotspotResponse]);
    vi.mocked(deleteHotspot).mockClear();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    await screen.findByText('Cliquez sur le panorama pour placer un hotspot.');

    const simBtn = await screen.findByTestId('mock-marker-select');
    fireEvent.click(simBtn);

    expect(await screen.findByText('Mon hotspot')).toBeDefined();

    const deleteBtn = await screen.findByText('Supprimer');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith('Supprimer ce hotspot ?');
    expect(deleteHotspot).not.toHaveBeenCalled();
    
    // Le panneau devrait rester sur le hotspot
    expect(await screen.findByText('Mon hotspot')).toBeDefined();
  });

  it('updates hotspot position on marker move with debounce', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);

    const mockHotspotResponse: HotspotResponse = {
      id: 'h-1', sceneId: 's-1', type: HotspotType.INFO, yaw: 0, pitch: 0, label: { fr: 'Mon hotspot' },
      targetSceneId: null, targetTourId: null, targetTourSceneId: null, body: { fr: 'Body' }, url: null,
      arrivalYaw: null, mediaAssetIds: [], icon: HotspotIcon.INFO,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(listHotspots).mockResolvedValue([mockHotspotResponse]);
    vi.mocked(updateHotspot).mockResolvedValue({ ...mockHotspotResponse, yaw: 1.2, pitch: 0.3 });

    render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    await screen.findByText('Cliquez sur le panorama pour placer un hotspot.');

    vi.useFakeTimers();
    const moveBtn = screen.getByTestId('mock-marker-move');
    fireEvent.click(moveBtn);

    expect(screen.getByText(/Modifications en attente/)).toBeDefined();
    expect(updateHotspot).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(updateHotspot).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    
    expect(updateHotspot).toHaveBeenCalledWith('h-1', expect.objectContaining({ yaw: 1.2, pitch: 0.3 }));
    expect(screen.getByText('Enregistré')).toBeDefined();
  });

  it('handles undo after marker move', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);

    const mockHotspotResponse: HotspotResponse = {
      id: 'h-1', sceneId: 's-1', type: HotspotType.INFO, yaw: 0, pitch: 0, label: { fr: 'Mon hotspot' },
      targetSceneId: null, targetTourId: null, targetTourSceneId: null, body: { fr: 'Body' }, url: null,
      arrivalYaw: null, mediaAssetIds: [], icon: HotspotIcon.INFO,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(listHotspots).mockResolvedValue([mockHotspotResponse]);

    render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);
    await screen.findByText('Cliquez sur le panorama pour placer un hotspot.');

    vi.useFakeTimers();
    const moveBtn = screen.getByTestId('mock-marker-move');
    fireEvent.click(moveBtn);

    expect(screen.getByText(/Modifications en attente/)).toBeDefined();

    const undoBtn = screen.getByText('Annuler');
    expect(undoBtn.hasAttribute('disabled')).toBe(false);
    
    // Simulate Ctrl+Z
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: false });

    // The component receives old position (0, 0) and schedules save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(updateHotspot).toHaveBeenCalledWith('h-1', expect.objectContaining({ yaw: 0, pitch: 0 }));
  });

  it('handles redo after undo', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);

    const mockHotspotResponse: HotspotResponse = {
      id: 'h-1', sceneId: 's-1', type: HotspotType.INFO, yaw: 0, pitch: 0, label: { fr: 'Mon hotspot' },
      targetSceneId: null, targetTourId: null, targetTourSceneId: null, body: { fr: 'Body' }, url: null,
      arrivalYaw: null, mediaAssetIds: [], icon: HotspotIcon.INFO,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(listHotspots).mockResolvedValue([mockHotspotResponse]);

    render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);
    await screen.findByText('Cliquez sur le panorama pour placer un hotspot.');

    vi.useFakeTimers();
    const moveBtn = screen.getByTestId('mock-marker-move');
    fireEvent.click(moveBtn);

    // Ctrl+Z
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: false });

    // Ctrl+Y
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true, shiftKey: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Mock move uses (1.2, 0.3)
    expect(updateHotspot).toHaveBeenCalledWith('h-1', expect.objectContaining({ yaw: 1.2, pitch: 0.3 }));
  });

  it('sets current view as initial view', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Titre' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([]);
    const mockAsset: AssetResponse = {
      id: '018b1d62-a5e3-7a91-9e23-2834b6b63300', filename: 'mock.jpg', kind: AssetKind.PANORAMA, mimeType: 'image/jpeg', sizeBytes: 1000,
      width: 4000, height: 2000, processingStatus: ProcessingStatus.READY, processingLog: null, copyright: null,
      thumbnailUrl: null, derivatives: {}, panorama: { preview: 'mock', web: 'mock', tiles: { width: 2, cols: 2, rows: 2, baseUrl: '' } },
      createdAt: new Date().toISOString(),
    };
    vi.mocked(getAsset).mockResolvedValue(mockAsset);
    vi.mocked(listHotspots).mockResolvedValue([]);
    vi.mocked(updateScene).mockResolvedValue({ ...mockSceneResponse, initialYaw: 0.5, initialPitch: -0.2, initialZoom: 40 });

    render(<SceneDetailPage />);

    const editorTab = await screen.findByText('Éditeur 360');
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    const btn = await screen.findByRole('button', { name: 'Définir la vue actuelle comme vue initiale' });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(updateScene).toHaveBeenCalledWith('s-1', {
        title: { fr: 'Titre' },
        panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
        weight: 0,
        caption: undefined,
        narration: undefined,
        ambientAssetId: undefined,
        initialYaw: 0.5,
        initialPitch: -0.2,
        initialZoom: 40,
      });
    });

    expect(await screen.findByText('Vue initiale enregistrée')).toBeDefined();
  });

  it('shows and handles arrival orientation button for SCENE_LINK hotspots', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1',
      tourId: 't-1',
      title: { fr: 'Scene 1' },
      panoramaAssetId: 'asset-1',
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
      weight: 0,
      hotspotCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const mockAsset: AssetResponse = {
      id: 'asset-1',
      filename: 'mock.jpg',
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      width: 4000,
      height: 2000,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: {
        preview: 'mock.jpg',
        web: 'mock.jpg',
        tiles: { width: 2048, cols: 4, rows: 2, baseUrl: 'mock/tiles/{col}_{row}.jpg' },
      },
      createdAt: new Date().toISOString(),
    };

    const sceneLinkHotspot: HotspotResponse = {
      id: 'h-1',
      sceneId: 's-1',
      type: HotspotType.SCENE_LINK,
      icon: HotspotIcon.ARROW,
      label: { fr: 'Link' },
      yaw: 1,
      pitch: 0,
      targetSceneId: 's-target',
      targetTourId: null,
      targetTourSceneId: null,
      body: { fr: '' },
      url: null,
      mediaAssetIds: [],
      arrivalYaw: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(getAsset).mockResolvedValue(mockAsset);
    vi.mocked(listScenes).mockResolvedValue([mockSceneResponse]);
    vi.mocked(listHotspots).mockResolvedValue([sceneLinkHotspot]);
    vi.mocked(updateHotspot).mockResolvedValue({ ...sceneLinkHotspot, arrivalYaw: 1.25 });

    render(<SceneDetailPage />);
    
    // Switch to editor tab
    const editorTab = await screen.findByRole('tab', { name: 'Éditeur 360' });
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    await waitFor(() => {
      expect(screen.getByTestId('mock-scene-editor')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('mock-marker-select'));

    await waitFor(() => {
      expect(screen.getByText('Définir l\'orientation d\'arrivée')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: "Définir l'orientation d'arrivée" }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-arrival-dialog')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Confirm mock arrival'));

    await waitFor(() => {
      expect(updateHotspot).toHaveBeenCalledWith('h-1', expect.objectContaining({ arrivalYaw: 1.25, yaw: 1, pitch: 0 }));
      expect(screen.getByText("Orientation d'arrivée enregistrée")).toBeDefined();
      expect(screen.queryByTestId('mock-arrival-dialog')).toBeNull();
    });
  });

  it('does not show arrival orientation button for INFO hotspots', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockSceneResponse: SceneResponse = {
      id: 's-1',
      tourId: 't-1',
      title: { fr: 'Scene 1' },
      panoramaAssetId: 'asset-1',
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
      weight: 0,
      hotspotCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const mockAsset: AssetResponse = {
      id: 'asset-1',
      filename: 'mock.jpg',
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      width: 4000,
      height: 2000,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: {
        preview: 'mock.jpg',
        web: 'mock.jpg',
        tiles: { width: 2048, cols: 4, rows: 2, baseUrl: 'mock/tiles/{col}_{row}.jpg' },
      },
      createdAt: new Date().toISOString(),
    };

    const infoHotspot: HotspotResponse = {
      id: 'h-1',
      sceneId: 's-1',
      type: HotspotType.INFO,
      icon: HotspotIcon.INFO,
      label: { fr: 'Info' },
      yaw: 0,
      pitch: 0,
      body: { fr: 'Text' },
      targetSceneId: null,
      targetTourId: null,
      targetTourSceneId: null,
      url: null,
      mediaAssetIds: [],
      arrivalYaw: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(getAsset).mockResolvedValue(mockAsset);
    vi.mocked(listScenes).mockResolvedValue([mockSceneResponse]);
    vi.mocked(listHotspots).mockResolvedValue([infoHotspot]);

    render(<SceneDetailPage />);
    
    // Switch to editor tab
    const editorTab = await screen.findByRole('tab', { name: 'Éditeur 360' });
    fireEvent.mouseDown(editorTab);
    fireEvent.click(editorTab);

    await waitFor(() => {
      expect(screen.getByTestId('mock-scene-editor')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('mock-marker-select'));

    await waitFor(() => {
      expect(screen.getByText('Info')).toBeDefined();
    });

    expect(screen.queryByText("Définir l'orientation d'arrivée")).toBeNull();
  });

  it('renders breadcrumbs and back link correctly', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });
    
    vi.mocked(getTour).mockResolvedValue({
      id: 't-1',
      title: { fr: 'Ma visite' },
      description: null,
      status: 'DRAFT',
      category: null,
      city: null,
      location: null,
      thumbnailAssetId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as TourResponse);

    const mockSceneResponse: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Ma scène' }, panoramaAssetId: '018b1d62-a5e3-7a91-9e23-2834b6b63300',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(getScene).mockResolvedValue(mockSceneResponse);
    vi.mocked(listScenes).mockResolvedValue([mockSceneResponse]);
    vi.mocked(updateScene).mockResolvedValue({ ...mockSceneResponse, title: { fr: 'Ma scène modifiée' } });

    const { container } = render(<SceneDetailPage />);
    
    // Check back link
    const backLink = await screen.findByText('← Retour à la visite');
    expect(backLink).toBeDefined();
    expect(backLink.getAttribute('href')).toBe('/tours/t-1');

    // Check click behavior on back link
    fireEvent.click(backLink);
    expect(navigate).toHaveBeenCalledWith('/tours/t-1');
    vi.mocked(navigate).mockClear();

    // Check ctrl+click behavior (should not call navigate)
    fireEvent.click(backLink, { ctrlKey: true });
    expect(navigate).not.toHaveBeenCalled();

    // Check breadcrumbs
    let toursLink = await screen.findByText('Visites');
    expect(toursLink.getAttribute('href')).toBe('/tours');

    let tourLink = await screen.findByText('Ma visite');
    expect(tourLink.getAttribute('href')).toBe('/tours/t-1');

    const currentScene = await screen.findByText('Ma scène');
    expect(currentScene).toBeDefined();

    // Verify breadcrumbs after save
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Ma scène modifiée' } });
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(updateScene).toHaveBeenCalled();
    });

    expect(await screen.findByText('Scène enregistrée avec succès')).toBeDefined();

    const updatedSceneInBreadcrumb = await screen.findByText('Ma scène modifiée');
    expect(updatedSceneInBreadcrumb).toBeDefined();

    // Re-verify links after save
    toursLink = await screen.findByText('Visites');
    expect(toursLink.getAttribute('href')).toBe('/tours');

    tourLink = await screen.findByText('Ma visite');
    expect(tourLink.getAttribute('href')).toBe('/tours/t-1');
    
    const backLinkAfterSave = await screen.findByText('← Retour à la visite');
    expect(backLinkAfterSave.getAttribute('href')).toBe('/tours/t-1');
  });

  it('renders breadcrumbs for a new scene', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 'new' },
      notice: null,
      search: '',
    });
    
    vi.mocked(getTour).mockResolvedValue({
      id: 't-1',
      title: { fr: 'Ma visite' },
      description: null,
      status: 'DRAFT',
      category: null,
      city: null,
      location: null,
      thumbnailAssetId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as TourResponse);

    vi.mocked(listScenes).mockResolvedValue([]);

    render(<SceneDetailPage />);
    
    // Check breadcrumbs
    const toursLink = await screen.findByText('Visites');
    expect(toursLink).toBeDefined();

    const tourLink = await screen.findByText('Ma visite');
    expect(tourLink).toBeDefined();

    const navElement = screen.getByRole('navigation', { name: "Fil d'Ariane" });
    const breadcrumbList = within(navElement).getByRole('list');
    const items = within(breadcrumbList).getAllByRole('listitem');
    const lastItem = items[items.length - 1];
    expect(lastItem).toBeDefined();
    expect(lastItem?.getAttribute('aria-current')).toBe('page');
    expect(lastItem?.textContent).toBe('Nouvelle scène');
  });

  it('affiche et gère correctement les liens scène précédente / suivante', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-2' },
      notice: null,
      search: '',
    });

    const mockScene2: SceneResponse = {
      id: 's-2', tourId: 't-1', title: { fr: 'Scène 2' }, panoramaAssetId: 'asset-1',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 1, hotspotCount: 0,
      createdAt: '', updatedAt: '',
    };
    const mockScene1: SceneResponse = { ...mockScene2, id: 's-1', title: { fr: 'Scène 1' }, weight: 0 };
    const mockScene3: SceneResponse = { ...mockScene2, id: 's-3', title: { fr: 'Scène 3' }, weight: 2 };

    vi.mocked(getScene).mockResolvedValue(mockScene2);
    vi.mocked(listScenes).mockResolvedValue([mockScene1, mockScene2, mockScene3]);
    vi.mocked(getAsset).mockResolvedValue(null as unknown as import('@xplor/shared').AssetResponse);
    vi.mocked(listHotspots).mockResolvedValue([]);

    render(<SceneDetailPage />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).toBeNull();
    });

    const prevLink = screen.getByText('← Scène précédente');
    const nextLink = screen.getByText('Scène suivante →');
    
    expect(prevLink.tagName).toBe('A');
    expect(prevLink.getAttribute('href')).toBe('/tours/t-1/scenes/s-1');
    
    expect(nextLink.tagName).toBe('A');
    expect(nextLink.getAttribute('href')).toBe('/tours/t-1/scenes/s-3');
    
    fireEvent.click(prevLink);
    expect(navigate).toHaveBeenCalledWith('/tours/t-1/scenes/s-1');
  });

  it('désactive les liens précédent/suivant aux extrémités', async () => {
    mockAuth();
    vi.mocked(useAppLocation).mockReturnValue({
      route: { name: 'scene-detail', tourId: 't-1', sceneId: 's-1' },
      notice: null,
      search: '',
    });

    const mockScene1: SceneResponse = {
      id: 's-1', tourId: 't-1', title: { fr: 'Scène 1' }, panoramaAssetId: 'asset-1',
      initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 0, hotspotCount: 0,
      createdAt: '', updatedAt: '',
    };
    
    vi.mocked(getScene).mockResolvedValue(mockScene1);
    vi.mocked(listScenes).mockResolvedValue([mockScene1]);
    vi.mocked(getAsset).mockResolvedValue(null as unknown as import('@xplor/shared').AssetResponse);
    vi.mocked(listHotspots).mockResolvedValue([]);

    render(<SceneDetailPage />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).toBeNull();
    });

    const prevSpan = screen.getByText('← Scène précédente');
    const nextSpan = screen.getByText('Scène suivante →');
    
    expect(prevSpan.tagName).toBe('SPAN');
    expect(nextSpan.tagName).toBe('SPAN');
  });
});
