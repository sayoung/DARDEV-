/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from 'vitest';
import { createVrRenderer } from './vr-renderer.js';
import * as viewerCoreExports from '../index.js';

const mockSetReferenceSpaceType = vi.fn();

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    xr = {
      enabled: false,
      setReferenceSpaceType: mockSetReferenceSpaceType,
      setSession: vi.fn().mockResolvedValue(undefined),
    };
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    setAnimationLoop = vi.fn();
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

describe('vr-renderer (M6 F-70)', () => {
  it('est importable en environnement avec support DOM', () => {
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

  it('appelle renderer.xr.setReferenceSpaceType avec local à l initialisation', () => {
    mockSetReferenceSpaceType.mockClear();
    const container = document.createElement('div');
    const handle = createVrRenderer(container);

    expect(mockSetReferenceSpaceType).toHaveBeenCalledTimes(1);
    expect(mockSetReferenceSpaceType).toHaveBeenCalledWith('local');

    handle.dispose();
  });
});
