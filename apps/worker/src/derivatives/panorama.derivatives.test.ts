import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePanoramaDerivatives } from './panorama.derivatives.js';
import sharp from 'sharp';

const mockToBuffer = vi.fn<() => Promise<Buffer>>();
const mockJpeg = vi.fn<(options?: { quality?: number }) => { toBuffer: typeof mockToBuffer }>();
const mockResize = vi.fn<(options: { width: number; height: number; fit: string }) => { jpeg: typeof mockJpeg }>();
const mockMetadata = vi.fn<() => Promise<{ width?: number; height?: number; format?: string }>>();

vi.mock('sharp', () => {
  return {
    default: vi.fn(() => ({
      metadata: mockMetadata,
      resize: mockResize,
    })),
  };
});

describe('generatePanoramaDerivatives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResize.mockReturnValue({ jpeg: mockJpeg });
    mockJpeg.mockReturnValue({ toBuffer: mockToBuffer });
  });

  it('should generate derivatives successfully', async () => {
    const fakeBuffer = Buffer.from('fake-image');
    const fakeThumbBuffer = Buffer.from('fake-thumb');

    mockMetadata.mockResolvedValue({ width: 4000, height: 2000, format: 'jpeg' });
    mockToBuffer.mockResolvedValue(fakeThumbBuffer);

    const result = await generatePanoramaDerivatives(fakeBuffer);

    expect(result.metadata.width).toBe(4000);
    expect(result.thumbnailBuffer).toBe(fakeThumbBuffer);

    expect(vi.mocked(sharp)).toHaveBeenCalledWith(fakeBuffer);
    expect(mockResize).toHaveBeenCalledWith({ width: 800, height: 400, fit: 'inside' });
    expect(mockJpeg).toHaveBeenCalledWith({ quality: 80 });
    expect(mockToBuffer).toHaveBeenCalled();
  });

});
