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
        { id: 'hs1', type: HotspotType.TOUR_LINK, targetTourId: 't2', targetSceneId: null, arrivalYaw: null, yaw: 0, pitch: 0, label: 'Link', icon: HotspotIcon.PORTAL }
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

  const labels = {
    nav: 'Nav', previous: 'Prev', next: 'Next', back: 'Back',
    fullscreen: 'FS', practicalInfo: 'Info',
    goTo: 'Go to {{title}}', confirm: 'Yes', cancel: 'No',
    loading: 'Loading', notFound: 'Not found', loadError: 'Error'
  };

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument();
  });

  const setupDeps = () => {
    const goToScene = vi.fn().mockResolvedValue(undefined);
    const destroy = vi.fn();
    const mountScene = vi.fn().mockReturnValue({ goToScene, destroy });
    
    const load = vi.fn().mockImplementation((token: string) => {
      if (token === 'token1') return Promise.resolve(mockGraph1);
      if (token === 'token2') return Promise.resolve(mockGraph2);
      return Promise.reject(new Error('Not found'));
    });

    return { load, mountScene, goToScene, destroy };
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
});
