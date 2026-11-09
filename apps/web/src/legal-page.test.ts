import { resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderLegalPage } from './legal-page.js';

describe('renderLegalPage', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    root.id = 'legal-container';
    document.body.appendChild(root);
  });

  const getFrTranslation = (key: string): string => {
    switch (key) {
      case 'legal.title':
        return resources.fr.legal.title;
      case 'legal.back':
        return resources.fr.legal.back;
      case 'legal.publisher.title':
        return resources.fr.legal.publisher.title;
      case 'legal.publisher.body':
        return resources.fr.legal.publisher.body;
      case 'legal.hosting.title':
        return resources.fr.legal.hosting.title;
      case 'legal.hosting.body':
        return resources.fr.legal.hosting.body;
      case 'legal.privacy.title':
        return resources.fr.legal.privacy.title;
      case 'legal.privacy.body':
        return resources.fr.legal.privacy.body;
      case 'legal.contact.title':
        return resources.fr.legal.contact.title;
      case 'legal.contact.body':
        return resources.fr.legal.contact.body;
      default:
        return key;
    }
  };

  it('titres et sections présents : produit un <main>, un <h1> et les 4 sections légales', () => {
    const main = renderLegalPage(document, root, getFrTranslation, 'fr', null);

    expect(main).not.toBeNull();
    expect(root.querySelector('main')).toBe(main);

    const h1 = main.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe(resources.fr.legal.title);

    const sections = main.querySelectorAll('section');
    expect(sections.length).toBe(4);

    const expectedBlocks = [
      {
        className: 'xplor-legal-publisher',
        title: resources.fr.legal.publisher.title,
        body: resources.fr.legal.publisher.body,
      },
      {
        className: 'xplor-legal-hosting',
        title: resources.fr.legal.hosting.title,
        body: resources.fr.legal.hosting.body,
      },
      {
        className: 'xplor-legal-privacy',
        title: resources.fr.legal.privacy.title,
        body: resources.fr.legal.privacy.body,
      },
      {
        className: 'xplor-legal-contact',
        title: resources.fr.legal.contact.title,
        body: resources.fr.legal.contact.body,
      },
    ];

    for (let i = 0; i < expectedBlocks.length; i += 1) {
      const expected = expectedBlocks[i];
      const section = sections[i];
      expect(section).toBeDefined();
      expect(section?.classList.contains(expected?.className ?? '')).toBe(true);

      const h2 = section?.querySelector('h2');
      expect(h2).not.toBeNull();
      expect(h2?.textContent).toBe(expected?.title);

      const p = section?.querySelector('p');
      expect(p).not.toBeNull();
      expect(p?.textContent).toBe(expected?.body);
    }
  });

  it('aucun innerHTML injecté : un texte contenant <b> reste du texte brut et n’est pas interprété', () => {
    const maliciousT = (key: string): string => {
      if (key === 'legal.title') {
        return '<b id="injected-title">Titre gras</b><script>alert("xss")</script>';
      }
      if (key === 'legal.publisher.title') {
        return '<b id="injected-publisher-title">Éditeur HTML</b>';
      }
      if (key === 'legal.publisher.body') {
        return '<b id="injected-publisher-body">Corps HTML</b><img src="x" onerror="evil()" />';
      }
      if (key === 'legal.back') {
        return '<b id="injected-back">Retour</b>';
      }
      return key;
    };

    renderLegalPage(document, root, maliciousT, 'fr', '/v/test-token');

    expect(root.querySelector('b')).toBeNull();
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('#injected-title')).toBeNull();
    expect(root.querySelector('#injected-publisher-title')).toBeNull();
    expect(root.querySelector('#injected-publisher-body')).toBeNull();
    expect(root.querySelector('#injected-back')).toBeNull();

    const h1 = root.querySelector('h1');
    expect(h1?.textContent).toBe('<b id="injected-title">Titre gras</b><script>alert("xss")</script>');
    expect(h1?.innerHTML).toContain('&lt;b id="injected-title"&gt;');

    const publisherH2 = root.querySelector('.xplor-legal-publisher h2');
    expect(publisherH2?.textContent).toBe('<b id="injected-publisher-title">Éditeur HTML</b>');
    expect(publisherH2?.innerHTML).toContain('&lt;b id="injected-publisher-title"&gt;');

    const publisherP = root.querySelector('.xplor-legal-publisher p');
    expect(publisherP?.textContent).toBe('<b id="injected-publisher-body">Corps HTML</b><img src="x" onerror="evil()" />');
    expect(publisherP?.innerHTML).toContain('&lt;b id="injected-publisher-body"&gt;');

    const backLink = root.querySelector('a');
    expect(backLink?.textContent).toBe('<b id="injected-back">Retour</b>');
    expect(backLink?.innerHTML).toContain('&lt;b id="injected-back"&gt;');
  });

  it('lien retour présent quand backHref n’est pas null', () => {
    renderLegalPage(document, root, getFrTranslation, 'fr', '/v/oudayas-123');

    const link = root.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/v/oudayas-123');
    expect(link?.textContent).toBe(resources.fr.legal.back);
    expect(link?.classList.contains('xplor-legal-back')).toBe(true);
  });

  it('lien retour absent quand backHref est null', () => {
    renderLegalPage(document, root, getFrTranslation, 'fr', null);

    const link = root.querySelector('a');
    expect(link).toBeNull();
  });

  it('dir=rtl pour ar : fixe dir="rtl" et lang="ar" sur l’élément racine', () => {
    const lang: Lang = 'ar';
    renderLegalPage(document, root, getFrTranslation, lang, null);

    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.getAttribute('lang')).toBe('ar');
    expect(root.dir).toBe('rtl');
    expect(root.lang).toBe('ar');
  });

  it('dir=ltr pour fr et en : fixe dir="ltr" sur l’élément racine', () => {
    renderLegalPage(document, root, getFrTranslation, 'fr', null);
    expect(root.getAttribute('dir')).toBe('ltr');
    expect(root.getAttribute('lang')).toBe('fr');
    expect(root.dir).toBe('ltr');
    expect(root.lang).toBe('fr');

    renderLegalPage(document, root, getFrTranslation, 'en', null);
    expect(root.getAttribute('dir')).toBe('ltr');
    expect(root.getAttribute('lang')).toBe('en');
    expect(root.dir).toBe('ltr');
    expect(root.lang).toBe('en');
  });

  it('remplace les enfants précédents et ajoute la classe xplor-legal sur racine et main', () => {
    const staleChild = document.createElement('div');
    staleChild.id = 'stale-placeholder';
    root.appendChild(staleChild);

    renderLegalPage(document, root, getFrTranslation, 'fr', null);

    expect(root.querySelector('#stale-placeholder')).toBeNull();
    expect(root.classList.contains('xplor-legal')).toBe(true);
    expect(root.querySelector('main')?.classList.contains('xplor-legal')).toBe(true);
  });
});
