import { describe, expect, it } from 'vitest';
import { createVrRenderer } from './vr-renderer.js';
import * as viewerCoreExports from '../index.js';

describe('vr-renderer (M6 F-70)', () => {
  it('est importable en environnement node sans erreur WebGL', () => {
    expect(createVrRenderer).toBeDefined();
  });

  it('exporte la fonction createVrRenderer', () => {
    expect(typeof createVrRenderer).toBe('function');
    expect(createVrRenderer.name).toBe('createVrRenderer');
    expect(createVrRenderer.length).toBe(1);
  });

  it('est réexporté depuis index.ts', () => {
    expect(viewerCoreExports.createVrRenderer).toBe(createVrRenderer);
  });
});
