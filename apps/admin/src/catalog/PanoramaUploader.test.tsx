import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PanoramaUploader } from './PanoramaUploader.js';
import * as client from '../api/client.js';
import { AssetKind, ProcessingStatus } from '@xplor/shared';

// Mock the API client
vi.mock('../api/client.js', () => ({
  uploadPanorama: vi.fn(),
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
          copyright: null, thumbnailUrl: null,
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
});
