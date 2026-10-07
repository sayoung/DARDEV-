import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArrivalOrientationDialog } from './ArrivalOrientationDialog.js';
import { getScene, getAsset } from '../api/catalog.js';
import { type SceneResponse, type AssetResponse, AssetKind, ProcessingStatus } from '@xplor/shared';
import React from 'react';
import type { SceneEditor360Props } from '../components/SceneEditor360.js';

vi.mock('../api/catalog.js', () => ({
  getScene: vi.fn(),
  getAsset: vi.fn(),
}));

vi.mock('../components/SceneEditor360.js', () => ({
  SceneEditor360: vi.fn(({ handleRef }: SceneEditor360Props) => {
    if (handleRef) {
      if (typeof handleRef === 'function') {
        handleRef({
          getView: () => ({ yaw: 1.23, pitch: 0, zoom: 50 })
        });
      } else if ('current' in handleRef) {
        handleRef.current = {
          getView: () => ({ yaw: 1.23, pitch: 0, zoom: 50 })
        };
      }
    }
    return <div data-testid="mock-scene-editor" />;
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ArrivalOrientationDialog', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders SceneEditor360 and calls onConfirm with yaw when asset is READY', async () => {
    const mockScene: SceneResponse = {
      id: '00000000-0000-0000-0000-000000000001',
      tourId: '00000000-0000-0000-0000-000000000001',
      title: { fr: 'Scene 1' },
      panoramaAssetId: '00000000-0000-0000-0000-000000000001',
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
      weight: 0,
      hotspotCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const mockAsset: AssetResponse = {
      id: '00000000-0000-0000-0000-000000000001',
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
        preview: 'http://test/pano.jpg',
        web: 'http://test/pano.jpg',
        tiles: { width: 4000, cols: 8, rows: 4, baseUrl: '' }
      },
      createdAt: new Date().toISOString(),
    };

    vi.mocked(getScene).mockResolvedValue(mockScene);
    vi.mocked(getAsset).mockResolvedValue(mockAsset);

    render(
      <ArrivalOrientationDialog
        open={true}
        targetSceneId="00000000-0000-0000-0000-000000000001"
        language="fr"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-scene-editor')).toBeDefined();
    });

    const confirmBtn = screen.getByRole('button', { name: 'catalog.hotspots.editor.useThisDirection' });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith(1.23);
  });

  it('displays alert when asset is not READY', async () => {
    const mockScene: SceneResponse = {
      id: '00000000-0000-0000-0000-000000000001',
      tourId: '00000000-0000-0000-0000-000000000001',
      title: { fr: 'Scene 1' },
      panoramaAssetId: '00000000-0000-0000-0000-000000000001',
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
      weight: 0,
      hotspotCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const mockAsset: AssetResponse = {
      id: '00000000-0000-0000-0000-000000000001',
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      width: 4000,
      height: 2000,
      processingStatus: ProcessingStatus.PROCESSING,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(getScene).mockResolvedValue(mockScene);
    vi.mocked(getAsset).mockResolvedValue(mockAsset);

    render(
      <ArrivalOrientationDialog
        open={true}
        targetSceneId="00000000-0000-0000-0000-000000000001"
        language="fr"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('catalog.scenes.editor.panoramaNotReady')).toBeDefined();
    });

    expect(screen.queryByTestId('mock-scene-editor')).toBeNull();
  });
});
