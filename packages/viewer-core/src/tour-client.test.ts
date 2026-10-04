import { describe, it, expect, vi } from 'vitest';
import { fetchTourGraph, TourNotFoundError, TourLoadError } from './tour-client.js';

describe('fetchTourGraph', () => {
  const validGraph = {
    id: 't_123',
    contentVersion: 1,
    lang: 'fr',
    title: 'Tour',
    summary: 'Summary',
    city: 'City',
    categories: [],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: 's_1',
    scenes: [
      {
        id: 's_1',
        title: 'Scene 1',
        caption: null,
        panorama: {
          preview: 'http://test/preview.jpg',
          web: 'http://test/web.jpg',
          tiles: {
            width: 512,
            cols: 4,
            rows: 2,
            baseUrl: 'http://test/tiles/',
          },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 1 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 'http://test/thumb.jpg',
        hotspots: [],
      }
    ],
    linkedTours: [],
  };

  it('should fetch and parse a valid tour graph', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(validGraph),
    });

    const result = await fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch);
    
    expect(mockFetch).toHaveBeenCalledWith('http://api.test/public/tours/tok_123?lang=fr');
    expect(result.id).toBe('t_123');
  });

  it('should handle trailing slash in baseUrl', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(validGraph),
    });

    await fetchTourGraph('http://api.test/', 'tok_123', 'fr', mockFetch);
    expect(mockFetch).toHaveBeenCalledWith('http://api.test/public/tours/tok_123?lang=fr');
  });

  it('should URL encode the share token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(validGraph),
    });

    await fetchTourGraph('http://api.test', 'tok/123+456', 'en', mockFetch);
    expect(mockFetch).toHaveBeenCalledWith('http://api.test/public/tours/tok%2F123%2B456?lang=en');
  });

  it('should throw TourNotFoundError on 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });

    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow(TourNotFoundError);
  });

  it('should throw TourLoadError on 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      statusText: 'Internal Server Error',
    });

    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow(TourLoadError);
    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow('Failed to fetch tour: 500 Internal Server Error');
  });

  it('should throw TourLoadError on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow(TourLoadError);
    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow('Network error: Network offline');
  });

  it('should throw TourLoadError on invalid JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.reject(new Error('SyntaxError: JSON')),
    });

    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow(TourLoadError);
    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow('Invalid JSON response');
  });

  it('should throw TourLoadError on invalid schema', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ id: 't_123' }), // missing required fields
    });

    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow(TourLoadError);
    await expect(fetchTourGraph('http://api.test', 'tok_123', 'fr', mockFetch))
      .rejects.toThrow(/Invalid tour data/);
  });
});
