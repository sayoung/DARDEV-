/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSceneAudioPlayer } from './scene-audio-player.js';
import { TourGraphScene } from '@xplor/shared';

describe('createSceneAudioPlayer', () => {
  let doc: Document;
  const labels = { play: 'Lecture', pause: 'Pause' };
  
  beforeEach(() => {
    doc = document.implementation.createHTMLDocument();
    // clear body
    doc.body.innerHTML = '';
  });

  const createMockAudio = (url: string) => {
    const audio = doc.createElement('audio');
    audio.src = url;
    // mock methods
    audio.play = vi.fn().mockResolvedValue(undefined);
    audio.pause = vi.fn();
    return audio;
  };

  const createScene = (id: string, narrationUrl: string | null = null, ambientUrl: string | null = null): TourGraphScene => ({
    id,
    title: 'Scene ' + id,
    caption: null,
    panorama: { preview: '', web: '', tiles: { width: 0, cols: 0, rows: 0, baseUrl: '' } },
    initialView: { yaw: 0, pitch: 0, zoom: 0 },
    thumb: 'thumb.jpg',
    narrationUrl,
    ambientUrl,
    hotspots: []
  });

  it('hides the button if there is no narration', () => {
    const { apply, destroy } = createSceneAudioPlayer(doc, labels, createMockAudio);
    const btn = doc.getElementById('scene-audio-btn') as HTMLButtonElement;
    
    expect(btn).not.toBeNull();
    expect(btn.hidden).toBe(true);

    const scene = createScene('1');
    apply(null, scene);

    expect(btn.hidden).toBe(true);
    destroy();
  });

  it('shows the button and allows play/pause if there is narration', () => {
    const { apply, destroy } = createSceneAudioPlayer(doc, labels, createMockAudio);
    const btn = doc.getElementById('scene-audio-btn') as HTMLButtonElement;

    const scene = createScene('1', 'narration.mp3');
    apply(null, scene);

    expect(btn.hidden).toBe(false);
    expect(btn.getAttribute('aria-label')).toBe(labels.play);

    // Click play
    btn.click();
    expect(btn.getAttribute('aria-label')).toBe(labels.pause);
    
    // Click pause
    btn.click();
    expect(btn.getAttribute('aria-label')).toBe(labels.play);

    destroy();
  });

  it('stops the old track when scene changes', () => {
    const mockPause = vi.fn();
    let lastAudio = doc.createElement('audio');
    const { apply, destroy } = createSceneAudioPlayer(doc, labels, (url) => {
      lastAudio = createMockAudio(url);
      lastAudio.pause = mockPause;
      return lastAudio;
    });
    
    const scene1 = createScene('1', 'narr1.mp3');
    apply(null, scene1);
    
    const audio1 = lastAudio;
    expect(audio1.src).toContain('narr1.mp3');
    
    const scene2 = createScene('2', 'narr2.mp3');
    apply(scene1, scene2);
    
    // Changing scene stops the old narration
    expect(mockPause).toHaveBeenCalled();
    expect(audio1.src).toBe(doc.location.href); // or '' depending on DOM implementation of src=''
    
    destroy();
  });

  it('removes the button on destroy', () => {
    const { destroy } = createSceneAudioPlayer(doc, labels, createMockAudio);
    expect(doc.getElementById('scene-audio-btn')).not.toBeNull();
    
    destroy();
    
    expect(doc.getElementById('scene-audio-btn')).toBeNull();
  });
});
