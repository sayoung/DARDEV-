import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createControls } from './controls';

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
});
