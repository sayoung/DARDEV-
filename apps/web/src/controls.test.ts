import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createControls } from './controls';

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
  });
});
