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

  it('removes the button and caption on destroy', () => {
    const { destroy } = createSceneAudioPlayer(doc, labels, createMockAudio);
    expect(doc.getElementById('scene-audio-btn')).not.toBeNull();
    expect(doc.getElementById('scene-caption')).not.toBeNull();
    
    destroy();
    
    expect(doc.getElementById('scene-audio-btn')).toBeNull();
    expect(doc.getElementById('scene-caption')).toBeNull();
  });

  it('shows caption if provided and hides if null or empty', () => {
    const { apply, destroy } = createSceneAudioPlayer(doc, labels, createMockAudio);
    const captionEl = doc.getElementById('scene-caption') as HTMLParagraphElement;
    
    expect(captionEl).not.toBeNull();
    expect(captionEl.hidden).toBe(true);

    const sceneWithCaption = createScene('1');
    sceneWithCaption.caption = 'Hello world';
    apply(null, sceneWithCaption);

    expect(captionEl.hidden).toBe(false);
    expect(captionEl.textContent).toBe('Hello world');

    const sceneWithoutCaption = createScene('2');
    sceneWithoutCaption.caption = null;
    apply(sceneWithCaption, sceneWithoutCaption);

    expect(captionEl.hidden).toBe(true);
    expect(captionEl.textContent).toBe('');
    
    const sceneEmptyCaption = createScene('3');
    sceneEmptyCaption.caption = '   ';
    apply(sceneWithoutCaption, sceneEmptyCaption);
    expect(captionEl.hidden).toBe(true);

    destroy();
  });

  it('replaces a caption with another when changing scenes', () => {
    const { apply, destroy } = createSceneAudioPlayer(doc, labels, createMockAudio);
    const captionEl = doc.getElementById('scene-caption') as HTMLParagraphElement;

    const sceneA = createScene('1');
    sceneA.caption = 'A';
    apply(null, sceneA);

    expect(captionEl.textContent).toBe('A');
    expect(captionEl.hidden).toBe(false);

    const sceneB = createScene('2');
    sceneB.caption = 'B';
    apply(sceneA, sceneB);

    expect(captionEl.textContent).toBe('B');
    expect(captionEl.hidden).toBe(false);

    destroy();
  });

  it('does not inject HTML when caption contains a script tag', () => {
    const { apply, destroy } = createSceneAudioPlayer(doc, labels, createMockAudio);
    const captionEl = doc.getElementById('scene-caption') as HTMLParagraphElement;

    const maliciousScene = createScene('1');
    maliciousScene.caption = '<script>alert("xss")</script>Test';
    apply(null, maliciousScene);

    // textContent escapes HTML automatically, so innerHTML will contain escaped entities
    expect(captionEl.innerHTML).toContain('&lt;script&gt;');
    expect(captionEl.querySelector('script')).toBeNull();
    
    destroy();
  });
});
