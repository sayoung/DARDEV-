import { resources } from '@xplor/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderScreen } from './render-screen.js';

describe('renderScreen (F-66)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  describe('écran UNAVAILABLE', () => {
    it('affiche le message kiosk.unavailable en plein écran neutre en français', () => {
      renderScreen(document, root, 'UNAVAILABLE', 'fr');

      expect(document.documentElement.getAttribute('lang')).toBe('fr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(root.getAttribute('lang')).toBe('fr');
      expect(root.getAttribute('dir')).toBe('ltr');
      expect(root.classList.contains('kiosk-screen-unavailable')).toBe(true);

      const statusContainer = root.querySelector('.kiosk-status-container');
      expect(statusContainer).toBeInstanceOf(HTMLElement);
      if (statusContainer instanceof HTMLElement) {
        expect(statusContainer.getAttribute('role')).toBe('status');
        expect(statusContainer.getAttribute('aria-live')).toBe('polite');
      }

      const message = root.querySelector('.kiosk-unavailable-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.fr.kiosk.unavailable);
      }
    });

    it('affiche le message en arabe avec dir="rtl"', () => {
      renderScreen(document, root, 'UNAVAILABLE', 'ar');

      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(root.getAttribute('dir')).toBe('rtl');

      const message = root.querySelector('.kiosk-unavailable-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.ar.kiosk.unavailable);
      }
    });

    it('affiche le message en anglais', () => {
      renderScreen(document, root, 'UNAVAILABLE', 'en');

      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');

      const message = root.querySelector('.kiosk-unavailable-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.en.kiosk.unavailable);
      }
    });

    it('ne contient aucun lien externe ni balise <a> ni attribut href (critère F-66)', () => {
      renderScreen(document, root, 'UNAVAILABLE', 'fr');

      const links = root.querySelectorAll('a');
      expect(links.length).toBe(0);

      const hrefElements = root.querySelectorAll('[href]');
      expect(hrefElements.length).toBe(0);
    });

    it('ne contient aucune visite ni carte de visite', () => {
      renderScreen(document, root, 'UNAVAILABLE', 'fr');

      const tourCards = root.querySelectorAll('.kiosk-tour-card');
      expect(tourCards.length).toBe(0);

      const buttons = root.querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });
  });

  describe('écran LOADING', () => {
    it('affiche un indicateur texte i18n accessible en français', () => {
      renderScreen(document, root, 'LOADING', 'fr');

      expect(root.classList.contains('kiosk-screen-loading')).toBe(true);

      const statusContainer = root.querySelector('.kiosk-status-container');
      expect(statusContainer).toBeInstanceOf(HTMLElement);
      if (statusContainer instanceof HTMLElement) {
        expect(statusContainer.getAttribute('role')).toBe('status');
        expect(statusContainer.getAttribute('aria-live')).toBe('polite');
      }

      const text = root.querySelector('.kiosk-loading-text');
      expect(text).toBeInstanceOf(HTMLParagraphElement);
      if (text instanceof HTMLParagraphElement) {
        expect(text.textContent).toBe(resources.fr.kiosk.loading);
      }
    });

    it('affiche l’indicateur texte en arabe avec dir="rtl"', () => {
      renderScreen(document, root, 'LOADING', 'ar');

      expect(root.getAttribute('dir')).toBe('rtl');
      const text = root.querySelector('.kiosk-loading-text');
      expect(text).toBeInstanceOf(HTMLParagraphElement);
      if (text instanceof HTMLParagraphElement) {
        expect(text.textContent).toBe(resources.ar.kiosk.loading);
      }
    });

    it('affiche l’indicateur texte en anglais', () => {
      renderScreen(document, root, 'LOADING', 'en');

      const text = root.querySelector('.kiosk-loading-text');
      expect(text).toBeInstanceOf(HTMLParagraphElement);
      if (text instanceof HTMLParagraphElement) {
        expect(text.textContent).toBe(resources.en.kiosk.loading);
      }
    });
  });

  describe('écran HOME', () => {
    it('vide le conteneur racine et applique la classe kiosk-screen-home', () => {
      const dummy = document.createElement('div');
      dummy.textContent = 'Ancien contenu';
      root.appendChild(dummy);

      renderScreen(document, root, 'HOME', 'fr');

      expect(root.children.length).toBe(0);
      expect(root.classList.contains('kiosk-screen-home')).toBe(true);
      expect(root.getAttribute('lang')).toBe('fr');
      expect(root.getAttribute('dir')).toBe('ltr');
    });
  });

  describe('écran ENROLL', () => {
    it('affiche le formulaire d’enrôlement avec libellés, champ code 8 caractères et bouton', () => {
      renderScreen(document, root, 'ENROLL', 'fr');

      expect(root.classList.contains('kiosk-screen-enroll')).toBe(true);

      const title = root.querySelector('.kiosk-enroll-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.fr.kiosk.enroll.title);
      }

      const instruction = root.querySelector('.kiosk-enroll-instruction');
      expect(instruction).toBeInstanceOf(HTMLParagraphElement);
      if (instruction instanceof HTMLParagraphElement) {
        expect(instruction.textContent).toBe(resources.fr.kiosk.enroll.instruction);
      }

      const label = root.querySelector('label.kiosk-enroll-label');
      expect(label).toBeInstanceOf(HTMLLabelElement);
      if (label instanceof HTMLLabelElement) {
        expect(label.textContent).toBe(resources.fr.kiosk.enroll.codeLabel);
        expect(label.htmlFor).toBe('kiosk-enroll-code');
      }

      const input = root.querySelector('input#kiosk-enroll-code');
      expect(input).toBeInstanceOf(HTMLInputElement);
      if (input instanceof HTMLInputElement) {
        expect(input.maxLength).toBe(8);
        expect(input.type).toBe('text');
        expect(input.getAttribute('aria-required')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBe('kiosk-enroll-error');
      }

      const button = root.querySelector('button[type="submit"]');
      expect(button).toBeInstanceOf(HTMLButtonElement);
      if (button instanceof HTMLButtonElement) {
        expect(button.textContent).toBe(resources.fr.kiosk.enroll.submit);
        expect(button.disabled).toBe(false);
      }
    });

    it('convertit automatiquement la saisie en majuscules', () => {
      renderScreen(document, root, 'ENROLL', 'fr');

      const input = root.querySelector('input#kiosk-enroll-code');
      expect(input).toBeInstanceOf(HTMLInputElement);
      if (input instanceof HTMLInputElement) {
        input.value = 'abcd1234';
        input.dispatchEvent(new Event('input'));
        expect(input.value).toBe('ABCD1234');
      }
    });

    it('appelle onEnroll(code) avec un code valide en majuscules (via objet handlers)', () => {
      const onEnroll = vi.fn();
      renderScreen(document, root, 'ENROLL', 'fr', { onEnroll });

      const input = root.querySelector('input#kiosk-enroll-code');
      const form = root.querySelector('form.kiosk-enroll-form');
      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(form).toBeInstanceOf(HTMLFormElement);

      if (input instanceof HTMLInputElement && form instanceof HTMLFormElement) {
        input.value = 'k1o2s3k4';
        input.dispatchEvent(new Event('input'));

        form.dispatchEvent(new Event('submit', { cancelable: true }));

        expect(onEnroll).toHaveBeenCalledTimes(1);
        expect(onEnroll).toHaveBeenCalledWith('K1O2S3K4');
      }
    });

    it('appelle onEnroll(code) lorsqu’une fonction est passée directement en 5e paramètre', () => {
      const onEnroll = vi.fn();
      renderScreen(document, root, 'ENROLL', 'fr', onEnroll);

      const input = root.querySelector('input#kiosk-enroll-code');
      const button = root.querySelector('button[type="submit"]');
      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(button).toBeInstanceOf(HTMLButtonElement);

      if (input instanceof HTMLInputElement && button instanceof HTMLButtonElement) {
        input.value = 'ABCDEFGH';
        button.click();

        expect(onEnroll).toHaveBeenCalledTimes(1);
        expect(onEnroll).toHaveBeenCalledWith('ABCDEFGH');
      }
    });

    it('désactive le bouton et empêche le double envoi lors de la soumission', () => {
      const onEnroll = vi.fn();
      renderScreen(document, root, 'ENROLL', 'fr', { onEnroll });

      const input = root.querySelector('input#kiosk-enroll-code');
      const form = root.querySelector('form.kiosk-enroll-form');
      const button = root.querySelector('button[type="submit"]');
      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(form).toBeInstanceOf(HTMLFormElement);
      expect(button).toBeInstanceOf(HTMLButtonElement);

      if (
        input instanceof HTMLInputElement &&
        form instanceof HTMLFormElement &&
        button instanceof HTMLButtonElement
      ) {
        input.value = 'ABCD1234';
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        expect(onEnroll).toHaveBeenCalledTimes(1);
        expect(button.disabled).toBe(true);
        expect(input.disabled).toBe(true);
        expect(button.textContent).toBe(resources.fr.kiosk.enroll.submitting);

        form.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(onEnroll).toHaveBeenCalledTimes(1);
      }
    });

    it('gère une fonction onEnroll asynchrone retournant une promesse résolue', async () => {
      let resolvePromise: (() => void) | undefined;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onEnroll = vi.fn().mockReturnValue(promise);

      renderScreen(document, root, 'ENROLL', 'fr', { onEnroll });

      const input = root.querySelector('input#kiosk-enroll-code');
      const form = root.querySelector('form.kiosk-enroll-form');
      const button = root.querySelector('button[type="submit"]');
      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(form).toBeInstanceOf(HTMLFormElement);
      expect(button).toBeInstanceOf(HTMLButtonElement);

      if (
        input instanceof HTMLInputElement &&
        form instanceof HTMLFormElement &&
        button instanceof HTMLButtonElement
      ) {
        input.value = 'ABCD1234';
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        expect(button.disabled).toBe(true);

        if (resolvePromise !== undefined) {
          resolvePromise();
        }
        await promise;
        await Promise.resolve();

        expect(button.disabled).toBe(false);
        expect(button.textContent).toBe(resources.fr.kiosk.enroll.submit);
      }
    });

    it('affiche une erreur traduite et réactive le bouton si onEnroll rejette une erreur', async () => {
      const onEnroll = vi.fn().mockRejectedValue(new Error('Code expiré ou déjà utilisé'));

      renderScreen(document, root, 'ENROLL', 'fr', { onEnroll });

      const input = root.querySelector('input#kiosk-enroll-code');
      const form = root.querySelector('form.kiosk-enroll-form');
      const button = root.querySelector('button[type="submit"]');
      const errorDiv = root.querySelector('.kiosk-enroll-error');

      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(form).toBeInstanceOf(HTMLFormElement);
      expect(button).toBeInstanceOf(HTMLButtonElement);
      expect(errorDiv).toBeInstanceOf(HTMLDivElement);

      if (
        input instanceof HTMLInputElement &&
        form instanceof HTMLFormElement &&
        button instanceof HTMLButtonElement &&
        errorDiv instanceof HTMLDivElement
      ) {
        input.value = 'ABCD1234';
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        await Promise.resolve();
        await Promise.resolve();

        expect(errorDiv.hidden).toBe(false);
        expect(errorDiv.textContent).toBe('Code expiré ou déjà utilisé');
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(button.disabled).toBe(false);
      }
    });

    it('refuse un code trop court et affiche l’erreur i18n sans appeler onEnroll', () => {
      const onEnroll = vi.fn();
      renderScreen(document, root, 'ENROLL', 'fr', { onEnroll });

      const input = root.querySelector('input#kiosk-enroll-code');
      const form = root.querySelector('form.kiosk-enroll-form');
      const errorDiv = root.querySelector('.kiosk-enroll-error');

      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(form).toBeInstanceOf(HTMLFormElement);
      expect(errorDiv).toBeInstanceOf(HTMLDivElement);

      if (
        input instanceof HTMLInputElement &&
        form instanceof HTMLFormElement &&
        errorDiv instanceof HTMLDivElement
      ) {
        input.value = 'ABC';
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        expect(onEnroll).not.toHaveBeenCalled();
        expect(errorDiv.hidden).toBe(false);
        expect(errorDiv.textContent).toBe(resources.fr.kiosk.enroll.invalidCode);
        expect(input.getAttribute('aria-invalid')).toBe('true');
      }
    });

    it('refuse un code contenant des caractères non alphanumériques', () => {
      const onEnroll = vi.fn();
      renderScreen(document, root, 'ENROLL', 'fr', { onEnroll });

      const input = root.querySelector('input#kiosk-enroll-code');
      const form = root.querySelector('form.kiosk-enroll-form');
      const errorDiv = root.querySelector('.kiosk-enroll-error');

      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(form).toBeInstanceOf(HTMLFormElement);
      expect(errorDiv).toBeInstanceOf(HTMLDivElement);

      if (
        input instanceof HTMLInputElement &&
        form instanceof HTMLFormElement &&
        errorDiv instanceof HTMLDivElement
      ) {
        input.value = 'ABC-1234';
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        expect(onEnroll).not.toHaveBeenCalled();
        expect(errorDiv.hidden).toBe(false);
        expect(errorDiv.textContent).toBe(resources.fr.kiosk.enroll.invalidCode);
      }
    });

    it('efface l’erreur lorsque l’utilisateur reprend la saisie', () => {
      renderScreen(document, root, 'ENROLL', 'fr');

      const input = root.querySelector('input#kiosk-enroll-code');
      const form = root.querySelector('form.kiosk-enroll-form');
      const errorDiv = root.querySelector('.kiosk-enroll-error');

      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(form).toBeInstanceOf(HTMLFormElement);
      expect(errorDiv).toBeInstanceOf(HTMLDivElement);

      if (
        input instanceof HTMLInputElement &&
        form instanceof HTMLFormElement &&
        errorDiv instanceof HTMLDivElement
      ) {
        input.value = 'COURT';
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(errorDiv.hidden).toBe(false);

        input.value = 'COURT1';
        input.dispatchEvent(new Event('input'));
        expect(errorDiv.hidden).toBe(true);
        expect(errorDiv.textContent).toBe('');
        expect(input.hasAttribute('aria-invalid')).toBe(false);
      }
    });

    it('supporte les langues RTL (arabe) pour l’écran d’enrôlement', () => {
      renderScreen(document, root, 'ENROLL', 'ar');

      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(root.getAttribute('dir')).toBe('rtl');

      const title = root.querySelector('.kiosk-enroll-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.ar.kiosk.enroll.title);
      }
    });
  });
});
