import { describe, expect, it } from 'vitest';

import { DEFAULT_API_URL, resolveApiUrl } from './api-url.js';

describe('resolveApiUrl', () => {
  describe('défaut', () => {
    it('renvoie l’URL par défaut quand la clé VITE_API_URL est absente', () => {
      expect(resolveApiUrl({})).toBe(DEFAULT_API_URL);
      expect(resolveApiUrl({})).toBe('http://localhost:3000');
    });

    it('renvoie l’URL par défaut quand VITE_API_URL vaut undefined', () => {
      expect(resolveApiUrl({ VITE_API_URL: undefined })).toBe('http://localhost:3000');
    });

    it('renvoie l’URL par défaut quand VITE_API_URL est vide ou uniquement composée d’espaces', () => {
      expect(resolveApiUrl({ VITE_API_URL: '' })).toBe('http://localhost:3000');
      expect(resolveApiUrl({ VITE_API_URL: '   ' })).toBe('http://localhost:3000');
    });

    it('renvoie l’URL par défaut quand VITE_API_URL ne contient que des barres obliques', () => {
      expect(resolveApiUrl({ VITE_API_URL: '/' })).toBe('http://localhost:3000');
      expect(resolveApiUrl({ VITE_API_URL: '///' })).toBe('http://localhost:3000');
    });
  });

  describe('valeur fournie', () => {
    it('renvoie l’URL fournie quand elle ne contient pas de barre oblique finale', () => {
      expect(resolveApiUrl({ VITE_API_URL: 'http://localhost:3000' })).toBe(
        'http://localhost:3000',
      );
      expect(resolveApiUrl({ VITE_API_URL: 'https://api.xplor.ma' })).toBe(
        'https://api.xplor.ma',
      );
      expect(resolveApiUrl({ VITE_API_URL: 'http://192.168.1.50:4000/subpath' })).toBe(
        'http://192.168.1.50:4000/subpath',
      );
    });
  });

  describe('slash final retiré', () => {
    it('retire la barre oblique finale unique', () => {
      expect(resolveApiUrl({ VITE_API_URL: 'http://localhost:3000/' })).toBe(
        'http://localhost:3000',
      );
      expect(resolveApiUrl({ VITE_API_URL: 'https://api.xplor.ma/' })).toBe(
        'https://api.xplor.ma',
      );
      expect(resolveApiUrl({ VITE_API_URL: 'http://192.168.1.50:4000/subpath/' })).toBe(
        'http://192.168.1.50:4000/subpath',
      );
    });

    it('retire les barres obliques finales multiples', () => {
      expect(resolveApiUrl({ VITE_API_URL: 'http://localhost:3000///' })).toBe(
        'http://localhost:3000',
      );
      expect(resolveApiUrl({ VITE_API_URL: 'https://api.xplor.ma//' })).toBe(
        'https://api.xplor.ma',
      );
      expect(resolveApiUrl({ VITE_API_URL: 'http://localhost:3000/api/v1///' })).toBe(
        'http://localhost:3000/api/v1',
      );
    });
  });
});
