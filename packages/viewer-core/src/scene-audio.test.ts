import { describe, it, expect } from 'vitest';
import { audioPlan, AMBIENT_VOLUME } from './scene-audio.js';
import { TourGraphSceneSchema } from '@xplor/shared';

describe('scene-audio', () => {
  const createScene = (narrationUrl: string | null, ambientUrl: string | null) => {
    return TourGraphSceneSchema.parse({
      id: 'scene-1',
      title: 'Scene 1',
      caption: null,
      panorama: {
        preview: 'http://example.com/preview.jpg',
        web: 'http://example.com/web.jpg',
        tiles: {
          width: 8192,
          cols: 16,
          rows: 8,
          baseUrl: 'http://example.com/tiles',
        },
      },
      initialView: {
        yaw: 0,
        pitch: 0,
        zoom: 50,
      },
      narrationUrl,
      ambientUrl,
      thumb: 'http://example.com/thumb.jpg',
      hotspots: [],
    });
  };

  it('première scène (prev null) avec audio', () => {
    const next = createScene('http://audio.com/narration1.mp3', 'http://audio.com/ambient1.mp3');
    const result = audioPlan(null, next);
    
    expect(result.narration.action).toBe('play');
    expect(result.narration.url).toBe('http://audio.com/narration1.mp3');
    
    expect(result.ambient.action).toBe('start');
    expect(result.ambient.url).toBe('http://audio.com/ambient1.mp3');
    expect(result.ambient.volume).toBe(AMBIENT_VOLUME);
  });

  it('même ambiance (keep)', () => {
    const prev = createScene(null, 'http://audio.com/ambient1.mp3');
    const next = createScene(null, 'http://audio.com/ambient1.mp3');
    const result = audioPlan(prev, next);
    
    expect(result.ambient.action).toBe('keep');
    expect(result.ambient.url).toBe('http://audio.com/ambient1.mp3');
  });

  it('ambiance qui change (start)', () => {
    const prev = createScene(null, 'http://audio.com/ambient1.mp3');
    const next = createScene(null, 'http://audio.com/ambient2.mp3');
    const result = audioPlan(prev, next);
    
    expect(result.ambient.action).toBe('start');
    expect(result.ambient.url).toBe('http://audio.com/ambient2.mp3');
  });

  it('ambiance qui disparaît (stop)', () => {
    const prev = createScene(null, 'http://audio.com/ambient1.mp3');
    const next = createScene(null, null);
    const result = audioPlan(prev, next);
    
    expect(result.ambient.action).toBe('stop');
    expect(result.ambient.url).toBeNull();
  });

  it('narration qui disparaît (stop)', () => {
    const prev = createScene('http://audio.com/narration1.mp3', null);
    const next = createScene(null, null);
    const result = audioPlan(prev, next);
    
    expect(result.narration.action).toBe('stop');
    expect(result.narration.url).toBeNull();
  });

  it('rien (none)', () => {
    const prev = createScene(null, null);
    const next = createScene(null, null);
    const result = audioPlan(prev, next);
    
    expect(result.narration.action).toBe('none');
    expect(result.narration.url).toBeNull();
    
    expect(result.ambient.action).toBe('none');
    expect(result.ambient.url).toBeNull();
  });
});
