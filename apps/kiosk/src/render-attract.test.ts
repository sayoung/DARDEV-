import { resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderAttract } from './render-attract.js';

describe('renderAttract (F-63)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  describe('affichage du message i18n et gestion LTR/RTL', () => {
    it('affiche le message kiosk.touchToExplore en plein écran en français avec dir="ltr"', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      expect(document.documentElement.getAttribute('lang')).toBe('fr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(root.getAttribute('lang')).toBe('fr');
      expect(root.getAttribute('dir')).toBe('ltr');
      expect(root.classList.contains('kiosk-screen')).toBe(true);
      expect(root.classList.contains('kiosk-screen-attract')).toBe(true);

      const message = root.querySelector('.kiosk-attract-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.fr.kiosk.touchToExplore);
      }

      const overlay = root.querySelector('.kiosk-attract-overlay');
      expect(overlay).toBeInstanceOf(HTMLDivElement);
    });

    it('affiche le message en arabe avec dir="rtl"', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'ar',
        onWake,
      });

      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(root.getAttribute('lang')).toBe('ar');
      expect(root.getAttribute('dir')).toBe('rtl');

      const message = root.querySelector('.kiosk-attract-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.ar.kiosk.touchToExplore);
      }
    });

    it('affiche le message en anglais avec dir="ltr"', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'en',
        onWake,
      });

      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(root.getAttribute('lang')).toBe('en');
      expect(root.getAttribute('dir')).toBe('ltr');

      const message = root.querySelector('.kiosk-attract-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.en.kiosk.touchToExplore);
      }
    });
  });

  describe('conteneur d’aperçu de la visite (data-tour-url)', () => {
    it('crée le conteneur avec l’attribut data-tour-url lorsqu’une URL de visite est fournie', () => {
      const onWake = vi.fn();
      const tourUrl = '/api/v1/tours/01990000-0000-7000-8000-000000000101';

      renderAttract(document, root, {
        tourUrl,
        lang: 'fr',
        onWake,
      });

      const preview = root.querySelector('.kiosk-attract-preview');
      expect(preview).toBeInstanceOf(HTMLDivElement);
      if (preview instanceof HTMLDivElement) {
        expect(preview.getAttribute('data-tour-url')).toBe(tourUrl);
      }

      const previewByAttr = root.querySelector('[data-tour-url]');
      expect(previewByAttr).toBe(preview);
    });

    it('crée le conteneur sans attribut data-tour-url lorsque tourUrl est null', () => {
      const onWake = vi.fn();

      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      const preview = root.querySelector('.kiosk-attract-preview');
      expect(preview).toBeInstanceOf(HTMLDivElement);
      if (preview instanceof HTMLDivElement) {
        expect(preview.getAttribute('data-tour-url')).toBeNull();
      }

      const previewByAttr = root.querySelector('[data-tour-url]');
      expect(previewByAttr).toBeNull();
    });
  });

  describe('écouteurs d’événements et déclenchement de onWake', () => {
    it('déclenche onWake lors d’un pointerdown sur la zone plein écran', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: '/api/v1/tours/demo',
        lang: 'fr',
        onWake,
      });

      root.dispatchEvent(new Event('pointerdown'));
      expect(onWake).toHaveBeenCalledTimes(1);
    });

    it('déclenche onWake lors d’un clic sur la zone plein écran', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      root.click();
      expect(onWake).toHaveBeenCalledTimes(1);
    });

    it('déclenche onWake lors d’un pointerdown sur le message textuel', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      const message = root.querySelector('.kiosk-attract-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        message.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(onWake).toHaveBeenCalledTimes(1);
      }
    });

    it('déclenche onWake lors d’un clic sur le message textuel', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      const message = root.querySelector('.kiosk-attract-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        message.click();
        expect(onWake).toHaveBeenCalledTimes(1);
      }
    });

    it('déclenche onWake lors d’un pointerdown sur l’aperçu de la visite', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: '/api/v1/tours/demo',
        lang: 'fr',
        onWake,
      });

      const preview = root.querySelector('.kiosk-attract-preview');
      expect(preview).toBeInstanceOf(HTMLDivElement);
      if (preview instanceof HTMLDivElement) {
        preview.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(onWake).toHaveBeenCalledTimes(1);
      }
    });

    it('déclenche onWake au clavier avec la touche Entrée', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(onWake).toHaveBeenCalledTimes(1);
    });

    it('déclenche onWake au clavier avec la barre d’espace', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      root.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      expect(onWake).toHaveBeenCalledTimes(1);
    });

    it('ne déclenche pas onWake avec d’autres touches du clavier (Tab, Échap)', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onWake).not.toHaveBeenCalled();
    });

    it('évite les appels en doublon lors d’un pointerdown suivi immédiatement d’un clic', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: null,
        lang: 'fr',
        onWake,
      });

      root.dispatchEvent(new Event('pointerdown'));
      root.click();

      expect(onWake).toHaveBeenCalledTimes(1);
    });

    it('nettoie les écouteurs précédents lorsqu’un nouveau rendu attract est exécuté sur le même conteneur', () => {
      const onWake1 = vi.fn();
      const onWake2 = vi.fn();

      renderAttract(document, root, {
        tourUrl: '/tour/1',
        lang: 'fr',
        onWake: onWake1,
      });

      renderAttract(document, root, {
        tourUrl: '/tour/2',
        lang: 'fr',
        onWake: onWake2,
      });

      root.click();

      expect(onWake1).not.toHaveBeenCalled();
      expect(onWake2).toHaveBeenCalledTimes(1);
    });
  });

  describe('sécurité et accessibilité', () => {
    it('ne contient aucun lien externe ni balise <a> ni attribut href', () => {
      const onWake = vi.fn();
      renderAttract(document, root, {
        tourUrl: 'https://example.com/external-tour',
        lang: 'fr',
        onWake,
      });

      const links = root.querySelectorAll('a');
      expect(links.length).toBe(0);

      const hrefElements = root.querySelectorAll('[href]');
      expect(hrefElements.length).toBe(0);
    });

    it('configure les attributs d’accessibilité ARIA et la navigation clavier', () => {
      const onWake = vi.fn();
      const lang: Lang = 'fr';
      renderAttract(document, root, {
        tourUrl: null,
        lang,
        onWake,
      });

      expect(root.getAttribute('tabindex')).toBe('0');
      expect(root.getAttribute('role')).toBe('region');
      expect(root.getAttribute('aria-label')).toBe(resources[lang].kiosk.touchToExplore);
    });
  });
});
