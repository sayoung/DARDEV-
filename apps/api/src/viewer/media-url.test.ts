import { describe, it, expect } from 'vitest';
import { mediaUrl, panoramaUrls } from './media-url.js';

describe('mediaUrl', () => {
  it('joint la base et la clé avec un seul "/"', () => {
    expect(mediaUrl('https://cdn.example.com', 'path/to/file.jpg')).toBe('https://cdn.example.com/path/to/file.jpg');
    expect(mediaUrl('https://cdn.example.com/', 'path/to/file.jpg')).toBe('https://cdn.example.com/path/to/file.jpg');
    expect(mediaUrl('https://cdn.example.com', '/path/to/file.jpg')).toBe('https://cdn.example.com/path/to/file.jpg');
    expect(mediaUrl('https://cdn.example.com/', '/path/to/file.jpg')).toBe('https://cdn.example.com/path/to/file.jpg');
  });

  it('encode correctement les segments contenant des espaces', () => {
    expect(mediaUrl('https://cdn.example.com', 'mon dossier/mon image.jpg')).toBe('https://cdn.example.com/mon%20dossier/mon%20image.jpg');
  });

  it('conserve le slash final de la clé', () => {
    expect(mediaUrl('https://cdn.example.com', 'tiles/')).toBe('https://cdn.example.com/tiles/');
  });
});

describe('panoramaUrls', () => {
  const validDerivatives = {
    preview: 'asset-1/preview.jpg',
    web: 'asset-1/web.jpg',
    thumb: 'asset-1/thumb.jpg',
    tilesPrefix: 'asset-1/tiles/',
    tileGrid: {
      cols: 16,
      rows: 8,
      size: 512,
    },
  };

  it('retourne les urls correctement formatées avec une largeur calculée (16x512 = 8192)', () => {
    const result = panoramaUrls('https://cdn.example.com', validDerivatives);

    expect(result).toEqual({
      preview: 'https://cdn.example.com/asset-1/preview.jpg',
      web: 'https://cdn.example.com/asset-1/web.jpg',
      thumb: 'https://cdn.example.com/asset-1/thumb.jpg',
      tiles: {
        width: 8192,
        cols: 16,
        rows: 8,
        baseUrl: 'https://cdn.example.com/asset-1/tiles/{col}_{row}.jpg',
      },
    });
  });

  it('lève une erreur si les dérivés sont incomplets', () => {
    const incompleteDerivatives = {
      preview: 'asset-1/preview.jpg',
      thumb: 'asset-1/thumb.jpg',
      tilesPrefix: 'asset-1/tiles/',
      tileGrid: {
        cols: 16,
        rows: 8,
        size: 512,
      },
    };

    expect(() => panoramaUrls('https://cdn.example.com', incompleteDerivatives)).toThrowError(/Format des dérivés invalide/);
  });

  it('lève une erreur si l\'entrée n\'est pas un objet', () => {
    expect(() => panoramaUrls('https://cdn.example.com', null)).toThrowError(/Format des dérivés invalide/);
    expect(() => panoramaUrls('https://cdn.example.com', 'string')).toThrowError(/Format des dérivés invalide/);
  });
});
