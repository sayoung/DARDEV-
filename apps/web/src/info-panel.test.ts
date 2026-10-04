import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openInfoPanel } from './info-panel';

describe('openInfoPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const sampleContent = {
    title: 'Titre Test',
    bodyHtml: '<p>Contenu <strong>HTML</strong></p>',
    images: ['img1.jpg', 'img2.jpg'],
  };

  const sampleLabels = {
    close: 'Fermer panneau',
  };

  it('rend le titre dans #info-panel-title et le corps HTML', () => {
    openInfoPanel(document, sampleContent, sampleLabels);
    const panel = document.getElementById('info-panel');
    expect(panel).not.toBeNull();

    const title = document.getElementById('info-panel-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Titre Test');

    const bodyDiv = panel?.querySelector('div');
    expect(bodyDiv?.innerHTML).toBe('<p>Contenu <strong>HTML</strong></p>');
  });

  it('crée une <img alt="" loading="lazy"> par image', () => {
    openInfoPanel(document, sampleContent, sampleLabels);
    const panel = document.getElementById('info-panel');
    const images = panel?.querySelectorAll('img');
    
    expect(images?.length).toBe(2);
    expect(images?.[0]?.src).toContain('img1.jpg');
    expect(images?.[0]?.getAttribute('alt')).toBe('');
    expect(images?.[0]?.getAttribute('loading')).toBe('lazy');
    expect(images?.[1]?.src).toContain('img2.jpg');
    expect(images?.[1]?.getAttribute('alt')).toBe('');
    expect(images?.[1]?.getAttribute('loading')).toBe('lazy');
  });

  it('applique les attributs role="dialog", aria-modal="false", aria-labelledby', () => {
    openInfoPanel(document, sampleContent, sampleLabels);
    const panel = document.getElementById('info-panel');
    
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('false');
    expect(panel?.getAttribute('aria-labelledby')).toBe('info-panel-title');
  });

  it('donne le focus au bouton Fermer avec aria-label = labels.close', () => {
    openInfoPanel(document, sampleContent, sampleLabels);
    const panel = document.getElementById('info-panel');
    const button = panel?.querySelector('button');
    
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe('Fermer panneau');
    expect(button?.getAttribute('aria-label')).toBe('Fermer panneau');
    expect(document.activeElement).toBe(button);
  });

  it('ferme le panneau par clic sur le bouton', () => {
    openInfoPanel(document, sampleContent, sampleLabels);
    let panel = document.getElementById('info-panel');
    expect(panel).not.toBeNull();

    const button = panel?.querySelector('button');
    button?.click();

    panel = document.getElementById('info-panel');
    expect(panel).toBeNull();
  });

  it("ferme le panneau par Échap (KeyboardEvent 'keydown' key 'Escape')", () => {
    openInfoPanel(document, sampleContent, sampleLabels);
    let panel = document.getElementById('info-panel');
    expect(panel).not.toBeNull();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    panel = document.getElementById('info-panel');
    expect(panel).toBeNull();
  });

  it('retire le panneau et l\'écouteur lors de l\'appel à close() (Échap ensuite sans effet)', () => {
    const { close } = openInfoPanel(document, sampleContent, sampleLabels);
    let panel = document.getElementById('info-panel');
    expect(panel).not.toBeNull();

    close();
    panel = document.getElementById('info-panel');
    expect(panel).toBeNull();

    // S'assurer que l'appel d'Échap ne provoque pas d'erreur ou ne fait rien de mal
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    expect(() => document.dispatchEvent(event)).not.toThrow();
  });

  it('ne laisse qu\'un seul #info-panel même si ouvert deux fois', () => {
    openInfoPanel(document, sampleContent, sampleLabels);
    openInfoPanel(document, sampleContent, sampleLabels);
    
    const panels = document.querySelectorAll('#info-panel');
    expect(panels.length).toBe(1);
  });

  it('ne crée aucun élément <script> si le titre contient <script>alert(1)</script>', () => {
    const maliciousContent = {
      ...sampleContent,
      title: '<script>alert(1)</script> Titre',
    };
    openInfoPanel(document, maliciousContent, sampleLabels);
    
    const panel = document.getElementById('info-panel');
    const scripts = panel?.querySelectorAll('script');
    expect(scripts?.length).toBe(0);

    const title = document.getElementById('info-panel-title');
    expect(title?.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Titre');
    expect(title?.textContent).toBe('<script>alert(1)</script> Titre');
  });
});
