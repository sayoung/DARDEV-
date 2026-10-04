import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createViewerController } from './viewer-controller.js';
import { TourGraph, HotspotType, HotspotIcon } from '@xplor/shared';

describe('createViewerController', () => {
  let doc: Document;

  const baseScene = {
    caption: null,
    panorama: {
      preview: 'url',
      web: 'url',
      tiles: { width: 1, cols: 1, rows: 1, baseUrl: 'url' }
    },
    initialView: { yaw: 0, pitch: 0, zoom: 1 },
    narrationUrl: null,
    ambientUrl: null,
    thumb: 'url'
  };

  const mockGraph1: TourGraph = {
    id: 't1',
    contentVersion: 1,
    lang: 'fr',
    title: 'Tour 1',
    summary: 'Sum',
    city: 'City',
    categories: [],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: 's1',
    scenes: [
      { id: 's1', title: 'S1', hotspots: [], ...baseScene },
      { id: 's2', title: 'S2', hotspots: [
        { id: 'hs1', type: HotspotType.TOUR_LINK, targetTourId: 't2', targetSceneId: null, arrivalYaw: null, yaw: 0, pitch: 0, label: 'Link', icon: HotspotIcon.PORTAL },
        { id: 'hs_info', type: HotspotType.INFO, bodyHtml: 'InfoBody', yaw: 0, pitch: 0, label: 'Info Label', icon: HotspotIcon.INFO, images: [] },
        { id: 'hs_url', type: HotspotType.URL, url: 'https://example.com', label: 'URLTitle', yaw: 0, pitch: 0, icon: HotspotIcon.INFO }
      ], ...baseScene }
    ],
    linkedTours: [
      { id: 't2', shareToken: 'token2', title: 'Tour 2', coverUrl: null, availableOffline: false }
    ]
  };

  const mockGraph2: TourGraph = {
    id: 't2',
    contentVersion: 1,
    lang: 'fr',
    title: 'Tour 2',
    summary: 'Sum',
    city: 'City',
    categories: [],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: 's3',
    scenes: [
      { id: 's3', title: 'S3', hotspots: [], ...baseScene }
    ],
    linkedTours: []
  };

  const mockGraph3: TourGraph = {
    id: 't3',
    contentVersion: 1,
    lang: 'fr',
    title: 'Tour 3',
    summary: 'Sum',
    city: 'City',
    categories: [],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: 's4',
    scenes: [
      { id: 's4', title: 'S4', hotspots: [], ...baseScene, narrationUrl: 'audio1.mp3' },
      { id: 's5', title: 'S5', hotspots: [], ...baseScene }
    ],
    linkedTours: []
  };

  const labels = {
    nav: 'Nav', previous: 'Prev', next: 'Next', back: 'Back',
    fullscreen: 'FS', practicalInfo: 'Info',
    goTo: 'Go to {{title}}', confirm: 'Yes', cancel: 'No',
    loading: 'Loading', notFound: 'Not found', loadError: 'Error',
    close: 'Close', play: 'Play', pause: 'Pause'
  };

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument();
  });

  const setupDeps = () => {
    const goToScene = vi.fn().mockResolvedValue(undefined);
    const destroy = vi.fn();
    const mountScene = vi.fn().mockReturnValue({ goToScene, destroy });
    const openUrl = vi.fn();
    
    const load = vi.fn().mockImplementation((token: string) => {
      if (token === 'token1') return Promise.resolve(mockGraph1);
      if (token === 'token2') return Promise.resolve(mockGraph2);
      if (token === 'token3') return Promise.resolve(mockGraph3);
      return Promise.reject(new Error('Not found'));
    });

    return { load, mountScene, goToScene, destroy, openUrl };
  };

  const getButton = (label: string) => {
    const nav = doc.getElementById('controls');
    if (!nav) throw new Error('No nav');
    const buttons = nav.querySelectorAll('button');
    const btn = Array.from(buttons).find(b => b.getAttribute('aria-label') === label);
    if (!btn) throw new Error(`No button ${label}`);
    return btn;
  };

  it('Suivant appelle goToScene avec la scène adjacente', async () => {
    const { load, mountScene, goToScene } = setupDeps();
    const controller = createViewerController(doc, { load, mountScene, labels });
    
    await controller.start('token1');
    expect(mountScene).toHaveBeenCalledWith(mockGraph1, 's1');

    const nextBtn = getButton('Next');
    nextBtn.click();
    
    await new Promise(r => setTimeout(r, 0));

    expect(goToScene).toHaveBeenCalledWith('s2');
  });

  it('TOUR_LINK refusé -> aucun chargement', async () => {
    const { load, mountScene } = setupDeps();
    const controller = createViewerController(doc, { load, mountScene, labels });
    
    await controller.start('token1');
    controller.onSceneChange('s2');

    const clickPromise = controller.onHotspotClick('hs1');
    
    await new Promise(r => setTimeout(r, 0));
    
    const cancelBtn = doc.querySelector('.confirm-dialog-btn-cancel');
    expect(cancelBtn).not.toBeNull();
    if (cancelBtn instanceof HTMLButtonElement) {
      cancelBtn.click();
    }
    
    await clickPromise;

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('TOUR_LINK accepté -> nouvelle visite montée', async () => {
    const { load, mountScene } = setupDeps();
    const controller = createViewerController(doc, { load, mountScene, labels });
    
    await controller.start('token1');
    controller.onSceneChange('s2');

    const clickPromise = controller.onHotspotClick('hs1');
    
    await new Promise(r => setTimeout(r, 0));
    
    const confirmBtn = doc.querySelector('.confirm-dialog-btn-confirm');
    expect(confirmBtn).not.toBeNull();
    if (confirmBtn instanceof HTMLButtonElement) {
      confirmBtn.click();
    }
    
    await clickPromise;

    expect(load).toHaveBeenCalledWith('token2');
    expect(mountScene).toHaveBeenCalledWith(mockGraph2, 's3');
  });

  it('Retour revient à la visite d\'origine', async () => {
    const { load, mountScene } = setupDeps();
    const controller = createViewerController(doc, { load, mountScene, labels });
    
    await controller.start('token1');
    controller.onSceneChange('s2');

    const clickPromise = controller.onHotspotClick('hs1');
    await new Promise(r => setTimeout(r, 0));
    
    const confirmBtn = doc.querySelector('.confirm-dialog-btn-confirm');
    if (confirmBtn instanceof HTMLButtonElement) {
      confirmBtn.click();
    }
    await clickPromise;

    expect(mountScene).toHaveBeenCalledWith(mockGraph2, 's3');

    const backBtn = getButton('Back');
    backBtn.click();
    await new Promise(r => setTimeout(r, 0));

    expect(mountScene).toHaveBeenCalledWith(mockGraph1, 's2');
  });

  it('clic sur un hotspot INFO → #info-panel présent', async () => {
    const { load, mountScene } = setupDeps();
    const controller = createViewerController(doc, { load, mountScene, labels });
    
    await controller.start('token1');
    controller.onSceneChange('s2');

    await controller.onHotspotClick('hs_info');
    
    const infoPanel = doc.getElementById('info-panel');
    expect(infoPanel).not.toBeNull();
  });

  it('clic sur un hotspot URL → openUrl appelé', async () => {
    const { load, mountScene, openUrl } = setupDeps();
    const controller = createViewerController(doc, { load, mountScene, labels, openUrl });
    
    await controller.start('token1');
    controller.onSceneChange('s2');

    await controller.onHotspotClick('hs_url');
    
    expect(openUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('id inconnu → aucun effet', async () => {
    const { load, mountScene, openUrl } = setupDeps();
    const controller = createViewerController(doc, { load, mountScene, labels, openUrl });
    
    await controller.start('token1');
    controller.onSceneChange('s2');

    await controller.onHotspotClick('hs_unknown');
    
    expect(openUrl).not.toHaveBeenCalled();
    const infoPanel = doc.getElementById('info-panel');
    expect(infoPanel).toBeNull();
    // No dialog shown either
    const confirmBtn = doc.querySelector('.confirm-dialog-btn-confirm');
    expect(confirmBtn).toBeNull();
  });

  it('clic sur Infos pratiques → #info-panel présent avec texte', async () => {
    const { load, mountScene } = setupDeps();
    const mockGraphInfo = { ...mockGraph1, practicalInfo: 'Horaires\n\nTarifs' };
    load.mockImplementation((token: string) => {
      if (token === 'token1') return Promise.resolve(mockGraphInfo);
      return Promise.reject(new Error('Not found'));
    });

    const controller = createViewerController(doc, { load, mountScene, labels });
    
    await controller.start('token1');

    const infoBtn = getButton('Info');
    infoBtn.click();

    const infoPanel = doc.getElementById('info-panel');
    expect(infoPanel).not.toBeNull();
    const div = infoPanel?.querySelector('div');
    expect(div?.innerHTML).toBe('<p>Horaires</p><p>Tarifs</p>');
  });

  it('scène avec narration affiche le bouton lecture, un changement de scène arrête la piste', async () => {
    const { load, mountScene } = setupDeps();
    
    let audioPlayed = false;
    let audioPaused = false;

    const mockAudio = doc.createElement('audio');
    vi.spyOn(mockAudio, 'play').mockImplementation(() => { audioPlayed = true; return Promise.resolve(); });
    vi.spyOn(mockAudio, 'pause').mockImplementation(() => { audioPaused = true; });

    const audioFactory = vi.fn().mockReturnValue(mockAudio);

    const controller = createViewerController(doc, { load, mountScene, labels, audioFactory });
    
    await controller.start('token3');
    
    // Scene s4 has narration, button should be visible and say Play
    const audioBtn = doc.getElementById('scene-audio-btn');
    if (!audioBtn) throw new Error('No audio btn');
    expect(audioBtn).not.toBeNull();
    expect(audioBtn.hidden).toBe(false);
    expect(audioBtn.getAttribute('aria-label')).toBe('Play');

    // Click play
    audioBtn.click();
    expect(audioPlayed).toBe(true);
    expect(audioBtn.getAttribute('aria-label')).toBe('Pause');

    // Change scene to s5 (no narration)
    controller.onSceneChange('s5');
    
    // Narration should stop
    expect(audioPaused).toBe(true);
    expect(audioBtn.hidden).toBe(true);

    // Destroy
    controller.destroy();
    expect(doc.getElementById('scene-audio-btn')).toBeNull();
  });
});
