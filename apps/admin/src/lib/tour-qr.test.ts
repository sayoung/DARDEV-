import { describe, it, expect } from 'vitest';
import { shareUrl, tourQrSvg } from './tour-qr';

describe('tour-qr', () => {
  describe('shareUrl', () => {
    it('construit l\'URL de base sans paramètres', () => {
      expect(shareUrl('http://localhost:5174', 'token123')).toBe('http://localhost:5174/v/token123');
    });

    it('gère les URL de base avec un slash final', () => {
      expect(shareUrl('http://localhost:5174/', 'token123')).toBe('http://localhost:5174/v/token123');
    });

    it('ajoute les paramètres de requête', () => {
      const url = shareUrl('http://localhost:5174', 'token123', { src: 'kiosk', h: '456' });
      expect(url).toBe('http://localhost:5174/v/token123?src=kiosk&h=456');
    });
  });

  describe('tourQrSvg', () => {
    it('génère un SVG valide', async () => {
      const svg = await tourQrSvg('http://localhost:5174/v/token123');
      expect(typeof svg).toBe('string');
      expect(svg.trim().startsWith('<svg')).toBe(true);
    });

    it('rejette avec une erreur si la génération échoue (ex: texte vide)', async () => {
      await expect(tourQrSvg('')).rejects.toThrow();
    });
  });
});
