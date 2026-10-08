import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { PanoramaUploader } from './PanoramaUploader.js';
import * as client from '../api/client.js';
import { AssetKind, ProcessingStatus } from '@xplor/shared';

// Mock the API client
vi.mock('../api/client.js', () => ({
  uploadPanorama: vi.fn(),
}));

vi.mock('../api/catalog.js', () => ({
  getAsset: vi.fn(),
  createScene: vi.fn(),
}));

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('PanoramaUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('uploads files sequentially and handles errors', async () => {
    const onUploaded = vi.fn();

    render(<PanoramaUploader onUploaded={onUploaded} />);

    // Select files
    const input = screen.getByLabelText('media.upload.select_files');
    const file1 = new File(['dummy1'], 'file1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['dummy2'], 'file2.jpg', { type: 'image/jpeg' });
    
    fireEvent.change(input, { target: { files: [file1, file2] } });

    expect(screen.getByText('file1.jpg')).toBeDefined();
    expect(screen.getByText('file2.jpg')).toBeDefined();

    // Mock upload responses
    vi.mocked(client.uploadPanorama).mockImplementation(async (file) => {
      if (file.name === 'file1.jpg') {
        return Promise.resolve({
          id: 'test-id',
          createdAt: new Date().toISOString(),
          kind: AssetKind.PANORAMA,
          filename: 'file1.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 100,
          width: 8000,
          height: 4000,
          processingStatus: ProcessingStatus.READY,
          processingLog: null,
          copyright: null,
          thumbnailUrl: null,
          derivatives: {},
          panorama: null,
        });
      } else {
        return Promise.reject(new Error('Fichier trop volumineux'));
      }
    });

    // Click submit
    const submitBtn = screen.getByRole('button', { name: 'media.upload.submit' });
    fireEvent.click(submitBtn);

    // Wait for the uploads to process
    await waitFor(() => {
      expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    });

    // Verify outcomes
    await waitFor(() => {
      expect(client.uploadPanorama).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledTimes(1);
    });

    // Check UI states
    expect(screen.getByText('media.upload.done')).toBeDefined(); // file1
    expect(screen.getByText('media.upload.error')).toBeDefined(); // file2
    expect(screen.getByText('Fichier trop volumineux')).toBeDefined(); // error msg for file2
    
  });

  it('creates scenes for successfully uploaded panoramas', async () => {
    const onUploaded = vi.fn();
    render(<PanoramaUploader onUploaded={onUploaded} tourId="test-tour" />);

    const input = screen.getByLabelText('media.upload.select_files');
    const file1 = new File(['dummy1'], 'file1.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file1] } });

    vi.mocked(client.uploadPanorama).mockResolvedValue({
      id: 'asset-id-1',
      createdAt: new Date().toISOString(),
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: 8000,
      height: 4000,
      processingStatus: ProcessingStatus.PENDING,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'media.upload.submit' }));

    await waitFor(() => {
      expect(screen.getByText('media.upload.create_scenes')).toBeDefined();
    });

    const catalog = await import('../api/catalog.js');
    
    vi.mocked(catalog.getAsset).mockResolvedValue({
      id: 'asset-id-1',
      createdAt: new Date().toISOString(),
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: 8000,
      height: 4000,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'media.upload.create_scenes' }));

    await waitFor(() => {
      expect(catalog.createScene).toHaveBeenCalledWith('test-tour', {
        title: { fr: 'file1', ar: '', en: '' },
        panoramaAssetId: 'asset-id-1',
        weight: 0,
        initialYaw: 0,
        initialPitch: 0,
        initialZoom: 50,
      });
    });
  });

  it('does not show create scenes button if tourId is missing', async () => {
    const onUploaded = vi.fn();
    render(<PanoramaUploader onUploaded={onUploaded} />); // no tourId

    const input = screen.getByLabelText('media.upload.select_files');
    const file1 = new File(['dummy1'], 'file1.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file1] } });

    vi.mocked(client.uploadPanorama).mockResolvedValue({
      id: 'asset-id-1',
      createdAt: new Date().toISOString(),
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: 8000,
      height: 4000,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'media.upload.submit' }));

    // Wait for the upload to finish
    await waitFor(() => {
      expect(screen.getByText('media.upload.done')).toBeDefined();
    });

    // Verify button is not present
    expect(screen.queryByRole('button', { name: 'media.upload.create_scenes' })).toBeNull();
  });

  it('shows error if asset is not READY when trying to create scene', async () => {
    const onUploaded = vi.fn();
    render(<PanoramaUploader onUploaded={onUploaded} tourId="test-tour" />);

    const input = screen.getByLabelText('media.upload.select_files');
    const file1 = new File(['dummy1'], 'file1.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file1] } });

    vi.mocked(client.uploadPanorama).mockResolvedValue({
      id: 'asset-id-1',
      createdAt: new Date().toISOString(),
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: 8000,
      height: 4000,
      processingStatus: ProcessingStatus.PENDING,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'media.upload.submit' }));

    await waitFor(() => {
      expect(screen.getByText('media.upload.create_scenes')).toBeDefined();
    });

    const catalog = await import('../api/catalog.js');
    
    vi.mocked(catalog.getAsset).mockResolvedValue({
      id: 'asset-id-1',
      createdAt: new Date().toISOString(),
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: 8000,
      height: 4000,
      processingStatus: ProcessingStatus.ERROR, // Simulate ERROR status
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'media.upload.create_scenes' }));

    await waitFor(() => {
      expect(screen.getByText('media.upload.scene_create_error')).toBeDefined();
    });
    expect(catalog.createScene).not.toHaveBeenCalled();
  });

  it('shows error if createScene fails', async () => {
    const onUploaded = vi.fn();
    render(<PanoramaUploader onUploaded={onUploaded} tourId="test-tour" />);

    const input = screen.getByLabelText('media.upload.select_files');
    const file1 = new File(['dummy1'], 'file1.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file1] } });

    vi.mocked(client.uploadPanorama).mockResolvedValue({
      id: 'asset-id-1',
      createdAt: new Date().toISOString(),
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: 8000,
      height: 4000,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'media.upload.submit' }));

    await waitFor(() => {
      expect(screen.getByText('media.upload.create_scenes')).toBeDefined();
    });

    const catalog = await import('../api/catalog.js');
    
    vi.mocked(catalog.getAsset).mockResolvedValue({
      id: 'asset-id-1',
      createdAt: new Date().toISOString(),
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: 8000,
      height: 4000,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: null,
      thumbnailUrl: null,
      derivatives: {},
      panorama: null,
    });

    vi.mocked(catalog.createScene).mockRejectedValue(new Error('Network Error'));

    fireEvent.click(screen.getByRole('button', { name: 'media.upload.create_scenes' }));

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeDefined();
    });
  });
});
