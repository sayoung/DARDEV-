import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openInfoPanel } from './info-panel';

describe('openInfoPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates the panel with correct elements and attributes', () => {
    const { close } = openInfoPanel(
      document,
      { title: 'My Title', bodyHtml: '<p>Some HTML</p>', images: ['img1.jpg', 'img2.png'] },
      { close: 'Fermer le panneau' }
    );

    const aside = document.getElementById('info-panel');
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute('role')).toBe('dialog');
    expect(aside?.getAttribute('aria-modal')).toBe('false');
    expect(aside?.getAttribute('aria-labelledby')).toBe('info-panel-title');

    const h2 = aside?.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(h2?.id).toBe('info-panel-title');
    expect(h2?.textContent).toBe('My Title');

    const div = aside?.querySelector('div');
    expect(div).not.toBeNull();
    expect(div?.innerHTML).toBe('<p>Some HTML</p>');

    const images = aside?.querySelectorAll('img');
    expect(images?.length).toBe(2);
    expect(images?.[0]?.getAttribute('alt')).toBe('');
    expect(images?.[0]?.getAttribute('loading')).toBe('lazy');
    expect(images?.[0]?.getAttribute('src')).toBe('img1.jpg');

    const button = aside?.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.type).toBe('button');
    expect(button?.textContent).toBe('Fermer');
    expect(button?.getAttribute('aria-label')).toBe('Fermer le panneau');
    expect(document.activeElement).toBe(button);

    close();
  });

  it('closes when clicking the close button', () => {
    openInfoPanel(
      document,
      { title: 'Title', bodyHtml: '', images: [] },
      { close: 'Close' }
    );

    const button = document.querySelector('button');
    expect(document.getElementById('info-panel')).not.toBeNull();
    
    button?.click();
    
    expect(document.getElementById('info-panel')).toBeNull();
  });

  it('closes on Escape keydown', () => {
    openInfoPanel(
      document,
      { title: 'Title', bodyHtml: '', images: [] },
      { close: 'Close' }
    );

    expect(document.getElementById('info-panel')).not.toBeNull();
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    
    expect(document.getElementById('info-panel')).toBeNull();
  });

  it('removes the previous panel and its listener when opened again', () => {
    openInfoPanel(
      document,
      { title: 'Title 1', bodyHtml: '', images: [] },
      { close: 'Close 1' }
    );
    
    expect(document.getElementById('info-panel-title')?.textContent).toBe('Title 1');

    openInfoPanel(
      document,
      { title: 'Title 2', bodyHtml: '', images: [] },
      { close: 'Close 2' }
    );
    
    // There should only be one panel
    const panels = document.querySelectorAll('#info-panel');
    expect(panels.length).toBe(1);
    expect(document.getElementById('info-panel-title')?.textContent).toBe('Title 2');
    
    // Trigger Escape to close
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    expect(document.getElementById('info-panel')).toBeNull();

    // Triggering it again should not error or bring it back
    document.dispatchEvent(event);
  });

  it('removes panel found in DOM not managed by current instance', () => {
    const dummyPanel = document.createElement('aside');
    dummyPanel.id = 'info-panel';
    document.body.appendChild(dummyPanel);

    openInfoPanel(
      document,
      { title: 'Title', bodyHtml: '', images: [] },
      { close: 'Close' }
    );

    const panels = document.querySelectorAll('#info-panel');
    expect(panels.length).toBe(1);
    expect(document.getElementById('info-panel-title')?.textContent).toBe('Title');
  });

  it('close() is idempotent and does not throw', () => {
    const { close } = openInfoPanel(
      document,
      { title: 'Title', bodyHtml: '', images: [] },
      { close: 'Close' }
    );

    expect(document.getElementById('info-panel')).not.toBeNull();
    close();
    expect(document.getElementById('info-panel')).toBeNull();
    
    // Second call should not throw or error
    expect(() => { close(); }).not.toThrow();
  });
});
