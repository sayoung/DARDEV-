import { describe, it, expect, vi, afterEach } from 'vitest';
import { isVrSupported } from './vr-support.js';
import { isVrSupported as isVrSupportedFromIndex } from '../index.js';

describe('isVrSupported', () => {
  it('est exporté depuis index.ts', () => {
    expect(isVrSupportedFromIndex).toBe(isVrSupported);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('xr absent', () => {
    it('renvoie false quand nav est vide (sans xr)', async () => {
      const nav = {};
      const result = await isVrSupported(nav);
      expect(result).toBe(false);
    });

    it('renvoie false quand nav.xr est explicitement undefined', async () => {
      const nav = { xr: undefined };
      const result = await isVrSupported(nav);
      expect(result).toBe(false);
    });
  });

  describe('support true', () => {
    it('renvoie true quand isSessionSupported("immersive-vr") résout à true', async () => {
      const requestedModes: string[] = [];
      const nav = {
        xr: {
          isSessionSupported(mode: string): Promise<boolean> {
            requestedModes.push(mode);
            return Promise.resolve(true);
          },
        },
      };

      const result = await isVrSupported(nav);

      expect(result).toBe(true);
      expect(requestedModes).toEqual(['immersive-vr']);
    });
  });

  describe('support false', () => {
    it('renvoie false quand isSessionSupported("immersive-vr") résout à false', async () => {
      const requestedModes: string[] = [];
      const nav = {
        xr: {
          isSessionSupported(mode: string): Promise<boolean> {
            requestedModes.push(mode);
            return Promise.resolve(false);
          },
        },
      };

      const result = await isVrSupported(nav);

      expect(result).toBe(false);
      expect(requestedModes).toEqual(['immersive-vr']);
    });
  });

  describe('rejet', () => {
    it('renvoie false et ne propage pas d’erreur quand isSessionSupported rejette une promesse', async () => {
      const nav = {
        xr: {
          isSessionSupported(): Promise<boolean> {
            return Promise.reject(new Error('WebXR session check failed'));
          },
        },
      };

      const result = await isVrSupported(nav);

      expect(result).toBe(false);
    });
  });

  describe('exception synchrone', () => {
    it('renvoie false quand isSessionSupported lève une exception de façon synchrone', async () => {
      const nav = {
        xr: {
          isSessionSupported(): Promise<boolean> {
            throw new Error('Synchronous WebXR failure');
          },
        },
      };

      const result = await isVrSupported(nav);

      expect(result).toBe(false);
    });

    it('renvoie false quand l’accès à la propriété xr lève une exception synchrone', async () => {
      const nav = {
        get xr(): { isSessionSupported(mode: string): Promise<boolean> } {
          throw new Error('Accès à xr impossible');
        },
      };

      const result = await isVrSupported(nav);

      expect(result).toBe(false);
    });
  });

  describe('repli sur globalThis.navigator', () => {
    it('utilise globalThis.navigator par défaut lorsque nav n’est pas fourni', async () => {
      let isCalled = false;
      const fakeGlobalNav = {
        xr: {
          isSessionSupported(mode: string): Promise<boolean> {
            if (mode === 'immersive-vr') {
              isCalled = true;
              return Promise.resolve(true);
            }
            return Promise.resolve(false);
          },
        },
      };

      vi.stubGlobal('navigator', fakeGlobalNav);

      const result = await isVrSupported();

      expect(result).toBe(true);
      expect(isCalled).toBe(true);
    });

    it('renvoie false par défaut dans un environnement où globalThis.navigator n’a pas xr', async () => {
      vi.stubGlobal('navigator', {});

      const result = await isVrSupported();

      expect(result).toBe(false);
    });
  });
});
