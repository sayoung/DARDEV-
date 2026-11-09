/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TourGraphSceneSchema, type TourGraphScene } from '@xplor/shared';
import { createControls } from './controls';

function makeScene(id: string, title: string, thumb = `thumb-${id}.jpg`): TourGraphScene {
  return TourGraphSceneSchema.parse({
    id,
    title,
    caption: null,
    panorama: {
      preview: `preview-${id}.jpg`,
      web: `web-${id}.jpg`,
      tiles: { width: 512, cols: 2, rows: 1, baseUrl: `tiles-${id}` },
    },
    initialView: { yaw: 0, pitch: 0, zoom: 0 },
    narrationUrl: null,
    ambientUrl: null,
    thumb,
    hotspots: [],
  });
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const rInt = parseInt(cleanHex.slice(0, 2), 16);
  const gInt = parseInt(cleanHex.slice(2, 4), 16);
  const bInt = parseInt(cleanHex.slice(4, 6), 16);
  const r = srgbToLinear(rInt / 255);
  const g = srgbToLinear(gInt / 255);
  const b = srgbToLinear(bInt / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number {
  const lum1 = hexToLuminance(hex1);
  const lum2 = hexToLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('createControls', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument();
  });

  const defaultLabels = {
    nav: 'Custom Controls',
    previous: 'Previous',
    next: 'Next',
    back: 'Back',
    fullscreen: 'Fullscreen',
    practicalInfo: 'Practical Info'
  };

  it('should render controls and append to body', () => {
    const handlers = {
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onBack: vi.fn(),
      onFullscreen: vi.fn(),
      onPracticalInfo: vi.fn()
    };

    const controls = createControls(doc, defaultLabels, handlers);

    const nav = doc.getElementById('controls');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Custom Controls');
    
    const buttons = nav?.querySelectorAll('button');
    expect(buttons?.length).toBe(5);
    
    if (!buttons) throw new Error('Missing buttons');
    const backBtn = buttons[0];
    const prevBtn = buttons[1];
    const nextBtn = buttons[2];
    const infoBtn = buttons[3];
    const fsBtn = buttons[4];
    if (!backBtn || !prevBtn || !nextBtn || !infoBtn || !fsBtn) throw new Error('Missing button');
    
    expect(backBtn.getAttribute('aria-label')).toBe('Back');
    expect(prevBtn.getAttribute('aria-label')).toBe('Previous');
    expect(nextBtn.getAttribute('aria-label')).toBe('Next');
    expect(infoBtn.getAttribute('aria-label')).toBe('Practical Info');
    expect(fsBtn.getAttribute('aria-label')).toBe('Fullscreen');

    // Initial state is enabled/visible without update
    controls.destroy();
  });

  it('should call handlers on button clicks', () => {
    const handlers = {
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onBack: vi.fn(),
      onFullscreen: vi.fn(),
      onPracticalInfo: vi.fn()
    };

    const controls = createControls(doc, defaultLabels, handlers);
    const nav = doc.getElementById('controls');
    if (!nav) throw new Error('Missing nav');

    // order is back, prev, next, info, fs
    const buttons = nav.querySelectorAll('button');
    const backBtn = buttons[0];
    const prevBtn = buttons[1];
    const nextBtn = buttons[2];
    const infoBtn = buttons[3];
    const fsBtn = buttons[4];
    if (!backBtn || !prevBtn || !nextBtn || !infoBtn || !fsBtn) throw new Error('Missing button');

    backBtn.click();
    expect(handlers.onBack).toHaveBeenCalledOnce();

    prevBtn.click();
    expect(handlers.onPrevious).toHaveBeenCalledOnce();

    nextBtn.click();
    expect(handlers.onNext).toHaveBeenCalledOnce();

    infoBtn.click();
    expect(handlers.onPracticalInfo).toHaveBeenCalledOnce();

    fsBtn.click();
    expect(handlers.onFullscreen).toHaveBeenCalledOnce();

    controls.destroy();
  });

  it('should update disabled and hidden states based on state', () => {
    const handlers = {
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onBack: vi.fn(),
      onFullscreen: vi.fn(),
      onPracticalInfo: vi.fn()
    };

    const controls = createControls(doc, defaultLabels, handlers);
    const nav = doc.getElementById('controls');
    if (!nav) throw new Error('Missing nav');
    const buttons = nav.querySelectorAll('button');
    const backBtn = buttons[0];
    const prevBtn = buttons[1];
    const nextBtn = buttons[2];
    const infoBtn = buttons[3];
    if (!backBtn || !prevBtn || !nextBtn || !infoBtn) throw new Error('Missing button');

    // All disabled/hidden
    controls.update({
      previous: null,
      next: null,
      canGoBack: false,
      hasPracticalInfo: false
    });

    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(true);
    expect(backBtn.hidden).toBe(true);
    expect(infoBtn.hidden).toBe(true);

    // All enabled/visible
    controls.update({
      previous: 'scene-1',
      next: 'scene-3',
      canGoBack: true,
      hasPracticalInfo: true
    });

    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(false);
    expect(backBtn.hidden).toBe(false);
    expect(infoBtn.hidden).toBe(false);

    controls.destroy();
  });

  it('destroy should remove the nav element', () => {
    const handlers = {
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onBack: vi.fn(),
      onFullscreen: vi.fn(),
      onPracticalInfo: vi.fn()
    };

    const controls = createControls(doc, defaultLabels, handlers);
    expect(doc.getElementById('controls')).not.toBeNull();

    controls.destroy();
    expect(doc.getElementById('controls')).toBeNull();
  });

  it('should assign classes xplor-nav-btn--prev and xplor-nav-btn--next to navigation buttons', () => {
    const handlers = {
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onBack: vi.fn(),
      onFullscreen: vi.fn(),
      onPracticalInfo: vi.fn()
    };

    const controls = createControls(doc, defaultLabels, handlers);
    const nav = doc.getElementById('controls');
    if (!nav) throw new Error('Missing nav');

    const prevBtn = nav.querySelector('button.xplor-nav-btn--prev');
    const nextBtn = nav.querySelector('button.xplor-nav-btn--next');

    expect(prevBtn).not.toBeNull();
    expect(nextBtn).not.toBeNull();
    if (!prevBtn || !nextBtn) throw new Error('Missing button');

    expect(prevBtn.textContent).toBe('❮');
    expect(prevBtn.getAttribute('aria-label')).toBe('Previous');
    expect(nextBtn.textContent).toBe('❯');
    expect(nextBtn.getAttribute('aria-label')).toBe('Next');

    // Other buttons do not have navigation arrow classes
    const allButtons = nav.querySelectorAll('button');
    for (const btn of Array.from(allButtons)) {
      if (btn !== prevBtn && btn !== nextBtn) {
        expect(btn.classList.contains('xplor-nav-btn--prev')).toBe(false);
        expect(btn.classList.contains('xplor-nav-btn--next')).toBe(false);
      }
    }

    controls.destroy();
  });

  describe('style.css navigation button classes and contrast', () => {
    it('should define classes, colors and states in style.css', () => {
      const cssPath = typeof __dirname !== 'undefined'
        ? path.resolve(__dirname, 'style.css')
        : path.resolve(process.cwd(), 'apps/web/src/style.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      // Classes defined
      expect(cssContent).toContain('.xplor-nav-btn--prev');
      expect(cssContent).toContain('.xplor-nav-btn--next');

      // Reference to requested original colors in notes
      expect(cssContent).toContain('#D64545');
      expect(cssContent).toContain('#1E9E4A');

      // Prev button (red): background #d24444, white text
      expect(cssContent).toMatch(/\.xplor-nav-btn--prev[\s\S]*?background-color:\s*#d24444/);
      expect(cssContent).toMatch(/\.xplor-nav-btn--prev[\s\S]*?color:\s*#ffffff/);

      // Next button (green): background #1a8840, white text
      expect(cssContent).toMatch(/\.xplor-nav-btn--next[\s\S]*?background-color:\s*#1a8840/);
      expect(cssContent).toMatch(/\.xplor-nav-btn--next[\s\S]*?color:\s*#ffffff/);

      // States :hover, :focus-visible and :disabled preserved
      expect(cssContent).toMatch(/\.xplor-nav-btn--prev:hover/);
      expect(cssContent).toMatch(/\.xplor-nav-btn--next:hover/);
      expect(cssContent).toMatch(/\.xplor-nav-btn--prev:focus-visible/);
      expect(cssContent).toMatch(/\.xplor-nav-btn--next:focus-visible/);
      expect(cssContent).toMatch(/\.xplor-nav-btn--prev:disabled/);
      expect(cssContent).toMatch(/\.xplor-nav-btn--next:disabled/);
    });

    it('should verify contrast ratios against white text (WCAG AA >= 4.5:1)', () => {
      // Original red #D64545 contrast with white text (#ffffff) fails threshold 4.5:1
      const origRedContrast = contrastRatio('#D64545', '#ffffff');
      expect(origRedContrast).toBeLessThan(4.5);
      expect(origRedContrast).toBeCloseTo(4.38, 1);

      // Slightly darkened red #d24444 achieves WCAG AA >= 4.5:1
      const darkenedRedContrast = contrastRatio('#d24444', '#ffffff');
      expect(darkenedRedContrast).toBeGreaterThanOrEqual(4.5);
      expect(darkenedRedContrast).toBeCloseTo(4.52, 1);

      // Original green #1E9E4A contrast with white text (#ffffff) fails threshold 4.5:1
      const origGreenContrast = contrastRatio('#1E9E4A', '#ffffff');
      expect(origGreenContrast).toBeLessThan(4.5);
      expect(origGreenContrast).toBeCloseTo(3.47, 1);

      // Slightly darkened green #1a8840 achieves WCAG AA >= 4.5:1
      const darkenedGreenContrast = contrastRatio('#1a8840', '#ffffff');
      expect(darkenedGreenContrast).toBeGreaterThanOrEqual(4.5);
      expect(darkenedGreenContrast).toBeCloseTo(4.53, 1);
    });

    it('should define places menu button and popover/sheet styles in style.css', () => {
      const cssPath = typeof __dirname !== 'undefined'
        ? path.resolve(__dirname, 'style.css')
        : path.resolve(process.cwd(), 'apps/web/src/style.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      expect(cssContent).toContain('.xplor-nav-btn--places');
      expect(cssContent).toContain('.xplor-places-panel');
      expect(cssContent).toContain('#places-panel');
      expect(cssContent).toContain('@media (max-width: 640px)');

      // Verify logical CSS properties
      expect(cssContent).toMatch(/inset-block-end:/);
      expect(cssContent).toMatch(/inset-inline:/);
      expect(cssContent).toMatch(/margin-inline:/);
      expect(cssContent).toMatch(/padding-block:/);
      expect(cssContent).toMatch(/padding-inline:/);
    });
  });

  describe('places menu button and dialog panel', () => {
    const mockScenes: TourGraphScene[] = [
      makeScene('s1', 'Salon (1/2)', 'thumb-salon1.jpg'),
      makeScene('s2', 'Salon (2/2)', 'thumb-salon2.jpg'),
      makeScene('s3', 'Piscine', 'thumb-piscine.jpg'),
    ];

    it('should not render places button when scenes are omitted', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(doc, defaultLabels, handlers);
      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      expect(placesBtn).toBeNull();
      controls.destroy();
    });

    it('should render places button before ❮ when scenes are provided', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes
      );
      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');

      const buttons = Array.from(nav.querySelectorAll('button'));
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      const prevBtn = nav.querySelector('button.xplor-nav-btn--prev');

      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');
      if (!(prevBtn instanceof HTMLButtonElement)) throw new Error('Missing prevBtn');

      expect(placesBtn.getAttribute('aria-label')).toBe('Lieux');
      expect(placesBtn.getAttribute('aria-haspopup')).toBe('dialog');
      expect(placesBtn.getAttribute('aria-expanded')).toBe('false');
      expect(placesBtn.innerHTML).toContain('<svg');

      const placesIndex = buttons.indexOf(placesBtn);
      const prevIndex = buttons.indexOf(prevBtn);
      expect(placesIndex).toBe(prevIndex - 1);

      controls.destroy();
    });

    it('should open dialog with places grouped by groupScenesIntoPlaces upon click', () => {
      const goToScene = vi.fn();
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux', placesTitle: 'Aller à' },
        handlers,
        mockScenes,
        goToScene
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      placesBtn.click();

      expect(placesBtn.getAttribute('aria-expanded')).toBe('true');
      const panel = doc.getElementById('places-panel');
      if (!panel) throw new Error('Missing panel');
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(panel.getAttribute('aria-modal')).toBe('true');

      const entryButtons = Array.from(panel.querySelectorAll('button.xplor-place-item'));
      expect(entryButtons.length).toBe(2);

      const salonBtn = entryButtons[0];
      const piscineBtn = entryButtons[1];
      if (!(salonBtn instanceof HTMLButtonElement) || !(piscineBtn instanceof HTMLButtonElement)) {
        throw new Error('Missing entry buttons');
      }

      expect(salonBtn.textContent).toContain('Salon');
      expect(salonBtn.textContent).toContain('2');
      const salonImg = salonBtn.querySelector('img');
      if (!salonImg) throw new Error('Missing salonImg');
      expect(salonImg.getAttribute('src')).toBe('thumb-salon1.jpg');

      expect(piscineBtn.textContent).toContain('Piscine');
      expect(piscineBtn.textContent).toContain('1');
      const piscineImg = piscineBtn.querySelector('img');
      if (!piscineImg) throw new Error('Missing piscineImg');
      expect(piscineImg.getAttribute('src')).toBe('thumb-piscine.jpg');

      // Initial active place: salon contains s1
      expect(salonBtn.getAttribute('aria-current')).toBe('true');
      expect(piscineBtn.getAttribute('aria-current')).toBeNull();

      controls.destroy();
    });

    it('should update aria-current on the place when update() is called', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        { scenes: mockScenes }
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      placesBtn.click();
      const panel = doc.getElementById('places-panel');
      if (!panel) throw new Error('Missing panel');
      const entryButtons = Array.from(panel.querySelectorAll('button.xplor-place-item'));
      const salonBtn = entryButtons[0];
      const piscineBtn = entryButtons[1];
      if (!(salonBtn instanceof HTMLButtonElement) || !(piscineBtn instanceof HTMLButtonElement)) {
        throw new Error('Missing entry buttons');
      }

      expect(salonBtn.getAttribute('aria-current')).toBe('true');
      expect(piscineBtn.getAttribute('aria-current')).toBeNull();

      controls.update({
        previous: null,
        next: null,
        canGoBack: false,
        hasPracticalInfo: false,
        currentSceneId: 's3',
      });

      expect(salonBtn.getAttribute('aria-current')).toBeNull();
      expect(piscineBtn.getAttribute('aria-current')).toBe('true');

      controls.destroy();
    });

    it('clicking an entry should call goToScene with firstSceneId and close panel', () => {
      const goToScene = vi.fn();
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes,
        goToScene
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      placesBtn.click();
      const panel = doc.getElementById('places-panel');
      if (!panel) throw new Error('Missing panel');
      const entryButtons = Array.from(panel.querySelectorAll('button.xplor-place-item'));
      const piscineBtn = entryButtons[1];
      if (!(piscineBtn instanceof HTMLButtonElement)) throw new Error('Missing piscineBtn');

      piscineBtn.click();

      expect(goToScene).toHaveBeenCalledWith('s3');
      expect(doc.getElementById('places-panel')).toBeNull();
      expect(placesBtn.getAttribute('aria-expanded')).toBe('false');

      controls.destroy();
    });

    it('pressing Escape should close the dialog and restore focus to places button', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      placesBtn.click();
      expect(doc.getElementById('places-panel')).not.toBeNull();

      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(doc.getElementById('places-panel')).toBeNull();
      expect(placesBtn.getAttribute('aria-expanded')).toBe('false');
      expect(doc.activeElement).toBe(placesBtn);

      controls.destroy();
    });

    it('clicking outside should close the dialog and restore focus to places button', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      placesBtn.click();
      expect(doc.getElementById('places-panel')).not.toBeNull();

      const outsideEl = doc.createElement('div');
      doc.body.appendChild(outsideEl);
      outsideEl.click();

      expect(doc.getElementById('places-panel')).toBeNull();
      expect(placesBtn.getAttribute('aria-expanded')).toBe('false');
      expect(doc.activeElement).toBe(placesBtn);

      outsideEl.remove();
      controls.destroy();
    });

    it('keyboard navigation with ArrowDown, ArrowUp, Enter, and Tab focus trap', () => {
      const goToScene = vi.fn();
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes,
        goToScene
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      placesBtn.click();
      const panel = doc.getElementById('places-panel');
      if (!panel) throw new Error('Missing panel');
      const entryButtons = Array.from(panel.querySelectorAll('button.xplor-place-item'));
      const firstEntry = entryButtons[0];
      const secondEntry = entryButtons[1];
      if (!(firstEntry instanceof HTMLButtonElement) || !(secondEntry instanceof HTMLButtonElement)) {
        throw new Error('Missing entry buttons');
      }

      // Initial focus is on the current place (firstEntry)
      expect(doc.activeElement).toBe(firstEntry);

      // ArrowDown moves to secondEntry
      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(doc.activeElement).toBe(secondEntry);

      // ArrowDown wraps to firstEntry
      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(doc.activeElement).toBe(firstEntry);

      // ArrowUp wraps to secondEntry
      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(doc.activeElement).toBe(secondEntry);

      // ArrowUp moves to firstEntry
      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(doc.activeElement).toBe(firstEntry);

      // Tab trap: Shift+Tab on first wraps to last
      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
      expect(doc.activeElement).toBe(secondEntry);

      // Tab trap: Tab on last wraps to first
      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true }));
      expect(doc.activeElement).toBe(firstEntry);

      // ArrowDown to secondEntry then Enter activates it
      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(doc.activeElement).toBe(secondEntry);

      doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(goToScene).toHaveBeenCalledWith('s3');
      expect(doc.getElementById('places-panel')).toBeNull();

      controls.destroy();
    });

    it('respects document dir for RTL', () => {
      doc.documentElement.setAttribute('dir', 'rtl');
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      placesBtn.click();
      const panel = doc.getElementById('places-panel');
      if (!panel) throw new Error('Missing panel');
      expect(panel.getAttribute('dir')).toBe('rtl');

      doc.documentElement.removeAttribute('dir');
      controls.destroy();
    });

    it('setVrActive(true) ferme un panneau ouvert et masque le bouton', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      expect(placesBtn.hidden).toBe(false);

      placesBtn.click();
      expect(doc.getElementById('places-panel')).not.toBeNull();
      expect(placesBtn.getAttribute('aria-expanded')).toBe('true');

      controls.setVrActive(true);

      expect(doc.getElementById('places-panel')).toBeNull();
      expect(placesBtn.getAttribute('aria-expanded')).toBe('false');
      expect(placesBtn.hidden).toBe(true);

      controls.destroy();
    });

    it('setVrActive(false) le ré-affiche', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      controls.setVrActive(true);
      expect(placesBtn.hidden).toBe(true);

      controls.setVrActive(false);
      expect(placesBtn.hidden).toBe(false);

      controls.destroy();
    });

    it('un panneau ne peut pas être ouvert tant que le bouton est masqué', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers,
        mockScenes
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      controls.setVrActive(true);
      expect(placesBtn.hidden).toBe(true);

      placesBtn.click();
      expect(doc.getElementById('places-panel')).toBeNull();
      expect(placesBtn.getAttribute('aria-expanded')).toBe('false');

      controls.setVrActive(false);
      expect(placesBtn.hidden).toBe(false);

      placesBtn.click();
      expect(doc.getElementById('places-panel')).not.toBeNull();
      expect(placesBtn.getAttribute('aria-expanded')).toBe('true');

      controls.destroy();
    });

    it('ensurePlacesButton respecte l\'état VR courant', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers
      );

      const nav = doc.getElementById('controls');
      if (!nav) throw new Error('Missing nav');
      expect(nav.querySelector('button.xplor-nav-btn--places')).toBeNull();

      controls.setVrActive(true);

      controls.update({
        previous: null,
        next: null,
        canGoBack: false,
        hasPracticalInfo: false,
        scenes: mockScenes,
      });

      const placesBtn = nav.querySelector('button.xplor-nav-btn--places');
      if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');

      expect(placesBtn.hidden).toBe(true);

      controls.setVrActive(false);
      expect(placesBtn.hidden).toBe(false);

      controls.destroy();
    });

    it('setVrActive ne plante pas lorsque #legal-link est absent du document', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers
      );

      // Sans #legal-link dans le document : aucun crash
      expect(() => {
        controls.setVrActive(true);
        controls.setVrActive(false);
      }).not.toThrow();

      controls.destroy();
    });

    it('setVrActive(true) masque #legal-link et setVrActive(false) le ré-affiche', () => {
      const handlers = {
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn(),
        onFullscreen: vi.fn(),
        onPracticalInfo: vi.fn(),
      };
      const controls = createControls(
        doc,
        { ...defaultLabels, places: 'Lieux' },
        handlers
      );

      // Avec #legal-link dans le document : masquage puis ré-affichage
      const link = doc.createElement('a');
      link.id = 'legal-link';
      doc.body.append(link);

      expect(link.hidden).toBe(false);

      controls.setVrActive(true);
      expect(link.hidden).toBe(true);

      controls.setVrActive(false);
      expect(link.hidden).toBe(false);

      link.remove();
      controls.destroy();
    });
  });

});
