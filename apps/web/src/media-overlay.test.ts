import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openMediaOverlay } from './media-overlay';

describe('openMediaOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    
    if (!('HTMLMediaElement' in window)) {
      Object.assign(window, { HTMLMediaElement: class HTMLMediaElement extends HTMLElement { pause() {} } });
    }
    
    if (!('pause' in HTMLMediaElement.prototype)) {
      Object.assign(HTMLMediaElement.prototype, { pause: () => {} });
    }
    
    if (!('pause' in HTMLVideoElement.prototype)) {
      Object.assign(HTMLVideoElement.prototype, { pause: () => {} });
    }
    
    if (!('pause' in HTMLAudioElement.prototype)) {
      Object.assign(HTMLAudioElement.prototype, { pause: () => {} });
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  const labels = {
    close: 'Fermer',
    previous: 'Précédent',
    next: 'Suivant',
  };

  it('ne crée rien dans le DOM si aucun média valide n\'est présent', () => {
    const { close } = openMediaOverlay(
      document,
      { title: 'Titre Test', media: [{ url: 'test.pdf', mimeType: 'application/pdf' }] },
      labels
    );
    expect(document.getElementById('media-overlay')).toBeNull();
    close();
  });

  it('crée une balise <img> pour un type image/*', () => {
    openMediaOverlay(
      document,
      { title: 'Image Test', media: [{ url: 'img.jpg', mimeType: 'image/jpeg' }] },
      labels
    );
    const overlay = document.getElementById('media-overlay');
    expect(overlay).not.toBeNull();
    
    const img = overlay?.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.src).toContain('img.jpg');
    expect(img?.alt).toBe('Image Test');
  });

  it('crée une balise <video> avec controls et playsinline pour un type video/*', () => {
    openMediaOverlay(
      document,
      { title: 'Video Test', media: [{ url: 'vid.mp4', mimeType: 'video/mp4' }] },
      labels
    );
    const overlay = document.getElementById('media-overlay');
    expect(overlay).not.toBeNull();
    
    const video = overlay?.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.src).toContain('vid.mp4');
    expect(video?.controls).toBe(true);
    expect(video?.playsInline).toBe(true);
  });

  it('crée une balise <audio> avec controls pour un type audio/*', () => {
    openMediaOverlay(
      document,
      { title: 'Audio Test', media: [{ url: 'aud.mp3', mimeType: 'audio/mpeg' }] },
      labels
    );
    const overlay = document.getElementById('media-overlay');
    expect(overlay).not.toBeNull();
    
    const audio = overlay?.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.src).toContain('aud.mp3');
    expect(audio?.controls).toBe(true);
  });

  it('ignore les types inconnus et affiche le premier média valide', () => {
    openMediaOverlay(
      document,
      {
        title: 'Mixed Test',
        media: [
          { url: 'doc.pdf', mimeType: 'application/pdf' },
          { url: 'vid.mp4', mimeType: 'video/mp4' },
          { url: 'img.png', mimeType: 'image/png' },
        ]
      },
      labels
    );
    const overlay = document.getElementById('media-overlay');
    const video = overlay?.querySelector('video');
    const img = overlay?.querySelector('img');
    
    // Le premier valide est video/mp4
    expect(video).not.toBeNull();
    expect(img).toBeNull(); // Affiché un par un
  });

  it('ferme la superposition par clic sur le bouton', () => {
    openMediaOverlay(
      document,
      { title: 'Image Test', media: [{ url: 'img.jpg', mimeType: 'image/jpeg' }] },
      labels
    );
    let overlay = document.getElementById('media-overlay');
    expect(overlay).not.toBeNull();

    const button = overlay?.querySelector('button');
    expect(button?.textContent).toBe('Fermer');
    expect(button?.getAttribute('aria-label')).toBe('Fermer');
    button?.click();

    overlay = document.getElementById('media-overlay');
    expect(overlay).toBeNull();
  });

  it('ferme la superposition par touche Échap', () => {
    openMediaOverlay(
      document,
      { title: 'Image Test', media: [{ url: 'img.jpg', mimeType: 'image/jpeg' }] },
      labels
    );
    let overlay = document.getElementById('media-overlay');
    expect(overlay).not.toBeNull();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    overlay = document.getElementById('media-overlay');
    expect(overlay).toBeNull();
  });

  it('appelle pause() sur la vidéo lors de la fermeture', () => {
    openMediaOverlay(
      document,
      { title: 'Video Test', media: [{ url: 'vid.mp4', mimeType: 'video/mp4' }] },
      labels
    );
    const overlay = document.getElementById('media-overlay');
    const video = overlay?.querySelector('video');
    const pauseMock = vi.fn();
    if (video) {
      video.pause = pauseMock;
    }

    const button = overlay?.querySelector('button');
    button?.click();

    expect(pauseMock).toHaveBeenCalled();
  });

  it('n\'ouvre qu\'une seule superposition et ferme la précédente', () => {
    openMediaOverlay(
      document,
      { title: 'Media 1', media: [{ url: '1.jpg', mimeType: 'image/jpeg' }] },
      labels
    );
    openMediaOverlay(
      document,
      { title: 'Media 2', media: [{ url: '2.jpg', mimeType: 'image/jpeg' }] },
      labels
    );
    
    const overlays = document.querySelectorAll('#media-overlay');
    expect(overlays.length).toBe(1);
    const img = overlays[0]?.querySelector('img');
    expect(img?.src).toContain('2.jpg');
  });

  it('n\'affiche pas de boutons précédent/suivant s\'il n\'y a qu\'un seul média', () => {
    openMediaOverlay(
      document,
      { title: 'Test 1', media: [{ url: '1.jpg', mimeType: 'image/jpeg' }] },
      labels
    );
    const overlay = document.getElementById('media-overlay');
    
    // Un seul bouton présent (Fermer)
    const buttons = overlay?.querySelectorAll('button');
    expect(buttons?.length).toBe(1);
    expect(buttons?.[0]?.textContent).toBe('Fermer');
  });

  it('affiche et gère la navigation précédent/suivant pour plusieurs médias', () => {
    const pauseSpy = vi.spyOn(HTMLVideoElement.prototype, 'pause');
    
    openMediaOverlay(
      document,
      {
        title: 'Multi',
        media: [
          { url: '1.jpg', mimeType: 'image/jpeg' },
          { url: '2.mp4', mimeType: 'video/mp4' },
          { url: '3.jpg', mimeType: 'image/jpeg' }
        ]
      },
      labels
    );
    
    const overlay = document.getElementById('media-overlay');
    expect(overlay).not.toBeNull();
    
    const buttons = Array.from(overlay?.querySelectorAll('button') || []);
    const prevButton = buttons.find(b => b.textContent === labels.previous) ;
    const nextButton = buttons.find(b => b.textContent === labels.next) ;
    
    expect(prevButton).toBeDefined();
    expect(nextButton).toBeDefined();
    
    // Début: index 0 (1.jpg)
    expect(overlay?.querySelector('img')?.src).toContain('1.jpg');
    expect(prevButton?.disabled).toBe(true);
    expect(nextButton?.disabled).toBe(false);
    
    // Clic Suivant -> index 1 (2.mp4)
    nextButton?.click();
    expect(overlay?.querySelector('img')).toBeNull();
    expect(overlay?.querySelector('video')?.src).toContain('2.mp4');
    expect(prevButton?.disabled).toBe(false);
    expect(nextButton?.disabled).toBe(false);
    
    // Clic Suivant -> index 2 (3.jpg)
    nextButton?.click();
    // Verify that pause was called when switching away from video
    expect(pauseSpy).toHaveBeenCalled();
    
    expect(overlay?.querySelector('video')).toBeNull();
    expect(overlay?.querySelector('img')?.src).toContain('3.jpg');
    expect(prevButton?.disabled).toBe(false);
    expect(nextButton?.disabled).toBe(true);
    
    // Clic Précédent -> index 1 (2.mp4)
    prevButton?.click();
    expect(overlay?.querySelector('img')).toBeNull();
    expect(overlay?.querySelector('video')?.src).toContain('2.mp4');
    expect(prevButton?.disabled).toBe(false);
    expect(nextButton?.disabled).toBe(false);
    
    pauseSpy.mockRestore();
  });

});


