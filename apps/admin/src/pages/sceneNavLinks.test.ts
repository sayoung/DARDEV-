import { describe, expect, it } from 'vitest';
import { getSceneNavLinks } from './sceneNavLinks.js';

describe('getSceneNavLinks', () => {
  it('should return correct links for a new scene (null currentSceneId)', () => {
    const links = getSceneNavLinks({
      tourId: 'tour-123',
      currentSceneId: null,
      scenes: [{ id: 'scene-1' }, { id: 'scene-2' }],
    });

    expect(links.toursListUrl).toBe('/tours');
    expect(links.tourDetailUrl).toBe('/tours/tour-123');
    expect(links.currentSceneUrl).toBeNull();
    expect(links.prevSceneUrl).toBeNull();
    expect(links.nextSceneUrl).toBeNull();
    expect(links.sceneUrl('some-id')).toBe('/tours/tour-123/scenes/some-id');
  });

  it('should return correct links for the first scene (no previous)', () => {
    const links = getSceneNavLinks({
      tourId: 'tour-123',
      currentSceneId: 'scene-1',
      scenes: [{ id: 'scene-1' }, { id: 'scene-2' }, { id: 'scene-3' }],
    });

    expect(links.currentSceneUrl).toBe('/tours/tour-123/scenes/scene-1');
    expect(links.prevSceneUrl).toBeNull();
    expect(links.nextSceneUrl).toBe('/tours/tour-123/scenes/scene-2');
  });

  it('should return correct links for a middle scene', () => {
    const links = getSceneNavLinks({
      tourId: 'tour-123',
      currentSceneId: 'scene-2',
      scenes: [{ id: 'scene-1' }, { id: 'scene-2' }, { id: 'scene-3' }],
    });

    expect(links.prevSceneUrl).toBe('/tours/tour-123/scenes/scene-1');
    expect(links.nextSceneUrl).toBe('/tours/tour-123/scenes/scene-3');
  });

  it('should return correct links for the last scene (no next)', () => {
    const links = getSceneNavLinks({
      tourId: 'tour-123',
      currentSceneId: 'scene-3',
      scenes: [{ id: 'scene-1' }, { id: 'scene-2' }, { id: 'scene-3' }],
    });

    expect(links.prevSceneUrl).toBe('/tours/tour-123/scenes/scene-2');
    expect(links.nextSceneUrl).toBeNull();
  });

  it('should return null for prev/next if currentSceneId is not in scenes', () => {
    const links = getSceneNavLinks({
      tourId: 'tour-123',
      currentSceneId: 'unknown-scene',
      scenes: [{ id: 'scene-1' }, { id: 'scene-2' }],
    });

    expect(links.currentSceneUrl).toBe('/tours/tour-123/scenes/unknown-scene');
    expect(links.prevSceneUrl).toBeNull();
    expect(links.nextSceneUrl).toBeNull();
  });

  it('should return null for prev/next if scenes array is empty', () => {
    const links = getSceneNavLinks({
      tourId: 'tour-123',
      currentSceneId: 'scene-1',
      scenes: [],
    });

    expect(links.currentSceneUrl).toBe('/tours/tour-123/scenes/scene-1');
    expect(links.prevSceneUrl).toBeNull();
    expect(links.nextSceneUrl).toBeNull();
  });
});
