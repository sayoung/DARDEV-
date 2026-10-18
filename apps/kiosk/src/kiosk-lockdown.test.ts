import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  installKioskLockdown,
  isExternalLinkElement,
  type KioskLockdownInstance,
} from './kiosk-lockdown.js';

describe('kiosk-lockdown (M5 F-60)', () => {
  let doc: Document;
  let lockdown: KioskLockdownInstance | null = null;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Kiosk Lockdown Test');
    doc.body.replaceChildren();
  });

  afterEach(() => {
    if (lockdown !== null) {
      lockdown.dispose();
      lockdown = null;
    }
  });

  describe('isExternalLinkElement', () => {
    it('renvoie true pour les liens commençant par http:// ou https:// (a[href^=http])', () => {
      const linkHttp = doc.createElement('a');
      linkHttp.setAttribute('href', 'http://example.com/page');
      doc.body.appendChild(linkHttp);

      const linkHttps = doc.createElement('a');
      linkHttps.setAttribute('href', 'https://xplor.ma/v/demo');
      const innerSpan = doc.createElement('span');
      innerSpan.textContent = 'Explore';
      linkHttps.appendChild(innerSpan);
      doc.body.appendChild(linkHttps);

      expect(isExternalLinkElement(linkHttp)).toBe(true);
      expect(isExternalLinkElement(linkHttps)).toBe(true);
      expect(isExternalLinkElement(innerSpan)).toBe(true);
    });

    it('renvoie false pour les liens internes, relatifs, ancres ou autres balises', () => {
      const relativeLink = doc.createElement('a');
      relativeLink.setAttribute('href', '/tours/kasbah');
      doc.body.appendChild(relativeLink);

      const hashLink = doc.createElement('a');
      hashLink.setAttribute('href', '#details');
      doc.body.appendChild(hashLink);

      const mailtoLink = doc.createElement('a');
      mailtoLink.setAttribute('href', 'mailto:admin@xplor.ma');
      doc.body.appendChild(mailtoLink);

      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = 'Valider';
      doc.body.appendChild(button);

      const input = doc.createElement('input');
      input.id = 'kiosk-enroll-code';
      input.className = 'kiosk-enroll-input';
      doc.body.appendChild(input);

      expect(isExternalLinkElement(relativeLink)).toBe(false);
      expect(isExternalLinkElement(hashLink)).toBe(false);
      expect(isExternalLinkElement(mailtoLink)).toBe(false);
      expect(isExternalLinkElement(button)).toBe(false);
      expect(isExternalLinkElement(input)).toBe(false);
      expect(isExternalLinkElement(null)).toBe(false);
    });
  });

  describe('Verrouillage contextmenu et dragstart', () => {
    it('bloque contextmenu sur le document et sur les éléments enfants', () => {
      lockdown = installKioskLockdown(doc);

      const button = doc.createElement('button');
      doc.body.appendChild(button);

      const docEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      doc.dispatchEvent(docEvent);
      expect(docEvent.defaultPrevented).toBe(true);

      const btnEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      button.dispatchEvent(btnEvent);
      expect(btnEvent.defaultPrevented).toBe(true);
    });

    it('bloque dragstart sur le document, les images et les liens', () => {
      lockdown = installKioskLockdown(doc);

      const img = doc.createElement('img');
      img.src = '/media/logo.png';
      doc.body.appendChild(img);

      const link = doc.createElement('a');
      link.href = '/tours/1';
      doc.body.appendChild(link);

      const docDrag = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      doc.dispatchEvent(docDrag);
      expect(docDrag.defaultPrevented).toBe(true);

      const imgDrag = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      img.dispatchEvent(imgDrag);
      expect(imgDrag.defaultPrevented).toBe(true);

      const linkDrag = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      link.dispatchEvent(linkDrag);
      expect(linkDrag.defaultPrevented).toBe(true);
    });

    it('bloque les clics sur les liens sortants a[href^=http] par preventDefault', () => {
      lockdown = installKioskLockdown(doc);

      const externalLink = doc.createElement('a');
      externalLink.setAttribute('href', 'https://google.com');
      const labelSpan = doc.createElement('span');
      labelSpan.textContent = 'Lien externe';
      externalLink.appendChild(labelSpan);
      doc.body.appendChild(externalLink);

      const clickExternal = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      externalLink.dispatchEvent(clickExternal);
      expect(clickExternal.defaultPrevented).toBe(true);

      const clickSpan = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      labelSpan.dispatchEvent(clickSpan);
      expect(clickSpan.defaultPrevented).toBe(true);

      const auxClick = new MouseEvent('auxclick', {
        bubbles: true,
        cancelable: true,
      });
      externalLink.dispatchEvent(auxClick);
      expect(auxClick.defaultPrevented).toBe(true);
    });

    it('ne bloque pas les clics sur les boutons, éléments internes et liens relatifs', () => {
      lockdown = installKioskLockdown(doc);

      const button = doc.createElement('button');
      doc.body.appendChild(button);

      const internalLink = doc.createElement('a');
      internalLink.setAttribute('href', '/tours/ouddayas');
      doc.body.appendChild(internalLink);

      const btnClick = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      button.dispatchEvent(btnClick);
      expect(btnClick.defaultPrevented).toBe(false);

      const linkClick = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      internalLink.dispatchEvent(linkClick);
      expect(linkClick.defaultPrevented).toBe(false);
    });
  });

  describe('Utilisabilité du champ d’enrôlement sous verrouillage', () => {
    it('le champ d’enrôlement reste utilisable (focus, saisie, frappe, sélection)', () => {
      lockdown = installKioskLockdown(doc);

      const form = doc.createElement('form');
      const input = doc.createElement('input');
      input.id = 'kiosk-enroll-code';
      input.className = 'kiosk-enroll-input';
      input.type = 'text';
      input.maxLength = 8;
      form.appendChild(input);
      doc.body.appendChild(form);

      // Focus
      input.focus();
      expect(doc.activeElement).toBe(input);

      // Saisie d'un code
      input.value = 'ABCD1234';
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      input.dispatchEvent(inputEvent);
      expect(input.value).toBe('ABCD1234');
      expect(inputEvent.defaultPrevented).toBe(false);

      // Touches clavier
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'A',
        code: 'KeyA',
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(keyEvent);
      expect(keyEvent.defaultPrevented).toBe(false);

      // Le champ n'est pas désactivé
      expect(input.disabled).toBe(false);

      // Les événements dragstart et contextmenu sur le champ d'enrôlement sont bien interceptés
      const ctxEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(ctxEvent);
      expect(ctxEvent.defaultPrevented).toBe(true);

      const dragEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(dragEvent);
      expect(dragEvent.defaultPrevented).toBe(true);
    });
  });

  describe('Nettoyage via dispose()', () => {
    it('détache tous les écouteurs lors de dispose()', () => {
      lockdown = installKioskLockdown(doc);
      lockdown.dispose();

      const externalLink = doc.createElement('a');
      externalLink.setAttribute('href', 'https://xplor.ma');
      doc.body.appendChild(externalLink);

      const ctxEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      doc.dispatchEvent(ctxEvent);
      expect(ctxEvent.defaultPrevented).toBe(false);

      const dragEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      doc.dispatchEvent(dragEvent);
      expect(dragEvent.defaultPrevented).toBe(false);

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      externalLink.dispatchEvent(clickEvent);
      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it('un appel répété à dispose() est sans effet secondaire', () => {
      lockdown = installKioskLockdown(doc);
      expect(() => {
        if (lockdown !== null) {
          lockdown.dispose();
          lockdown.dispose();
        }
      }).not.toThrow();
    });
  });

  describe('Conformité de apps/kiosk/src/style.css', () => {
    it('désactive user-select, tap highlight et overscroll-behavior sauf sur kiosk-enroll-input', () => {
      const cssPath = path.resolve(__dirname, 'style.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      // overscroll-behavior: none sur html / body
      expect(cssContent).toMatch(/overscroll-behavior:\s*none/);

      // tap-highlight-color: transparent sur body
      expect(cssContent).toMatch(/-webkit-tap-highlight-color:\s*transparent/);

      // user-select: none sur body
      expect(cssContent).toMatch(/user-select:\s*none/);
      expect(cssContent).toMatch(/-webkit-user-select:\s*none/);

      // Exception explicite pour le champ du code d'enrôlement : user-select: text
      expect(cssContent).toMatch(
        /\.kiosk-enroll-input[\s\S]*?user-select:\s*text/,
      );
      expect(cssContent).toMatch(
        /\.kiosk-enroll-input[\s\S]*?-webkit-user-select:\s*text/,
      );
    });
  });
});
