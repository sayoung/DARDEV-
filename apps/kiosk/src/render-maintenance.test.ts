import { resources } from '@xplor/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderMaintenancePin } from './render-maintenance.js';

describe('renderMaintenancePin (F-67)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  function getDigitButton(digit: string): HTMLButtonElement {
    const btn = root.querySelector(`button[data-testid="kiosk-pin-digit-${digit}"]`);
    expect(btn).toBeInstanceOf(HTMLButtonElement);
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error(`Bouton chiffre ${digit} introuvable`);
    }
    return btn;
  }

  function getClearButton(): HTMLButtonElement {
    const btn = root.querySelector('button[data-testid="kiosk-pin-clear"]');
    expect(btn).toBeInstanceOf(HTMLButtonElement);
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error('Bouton effacer introuvable');
    }
    return btn;
  }

  function getSubmitButton(): HTMLButtonElement {
    const btn = root.querySelector('button[data-testid="kiosk-pin-submit"]');
    expect(btn).toBeInstanceOf(HTMLButtonElement);
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error('Bouton valider introuvable');
    }
    return btn;
  }

  function getCancelButton(): HTMLButtonElement {
    const btn = root.querySelector('button[data-testid="kiosk-pin-cancel"]');
    expect(btn).toBeInstanceOf(HTMLButtonElement);
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error('Bouton annuler introuvable');
    }
    return btn;
  }

  function getPinInput(): HTMLInputElement {
    const input = root.querySelector('input#kiosk-pin-input');
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Champ de saisie PIN introuvable');
    }
    return input;
  }

  function getErrorDiv(): HTMLDivElement {
    const div = root.querySelector('#kiosk-pin-error');
    expect(div).toBeInstanceOf(HTMLDivElement);
    if (!(div instanceof HTMLDivElement)) {
      throw new Error('Conteneur d’erreur introuvable');
    }
    return div;
  }

  describe('structure et accessibilité', () => {
    it('affiche le dialogue accessible avec titre, sous-titre, champ masqué et boutons 0-9', () => {
      const verify = vi.fn().mockResolvedValue(true);
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      expect(document.documentElement.getAttribute('lang')).toBe('fr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(root.getAttribute('lang')).toBe('fr');
      expect(root.getAttribute('dir')).toBe('ltr');
      expect(root.classList.contains('kiosk-screen-maintenance')).toBe(true);

      const main = root.querySelector('main.kiosk-maintenance-container');
      expect(main).toBeInstanceOf(HTMLElement);
      if (main instanceof HTMLElement) {
        expect(main.getAttribute('role')).toBe('dialog');
        expect(main.getAttribute('aria-modal')).toBe('true');
        expect(main.getAttribute('aria-labelledby')).toBe('kiosk-maintenance-title');
      }

      const title = root.querySelector('#kiosk-maintenance-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.fr.kiosk.maintenance.title);
      }

      const subtitle = root.querySelector('.kiosk-maintenance-subtitle');
      expect(subtitle).toBeInstanceOf(HTMLParagraphElement);
      if (subtitle instanceof HTMLParagraphElement) {
        expect(subtitle.textContent).toBe(resources.fr.kiosk.maintenance.subtitle);
      }

      const input = getPinInput();
      expect(input.type).toBe('password');
      expect(input.maxLength).toBe(12);
      expect(input.getAttribute('aria-required')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe('kiosk-pin-error');
      expect(input.placeholder).toBe(resources.fr.kiosk.maintenance.pinPlaceholder);
      expect(input.value).toBe('');

      const label = root.querySelector('label.kiosk-pin-label');
      expect(label).toBeInstanceOf(HTMLLabelElement);
      if (label instanceof HTMLLabelElement) {
        expect(label.textContent).toBe(resources.fr.kiosk.maintenance.pinLabel);
        expect(label.htmlFor).toBe('kiosk-pin-input');
      }

      // Touches numériques 0 à 9
      for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
        const btn = getDigitButton(d);
        expect(btn.textContent).toBe(d);
        expect(btn.type).toBe('button');
        expect(btn.disabled).toBe(false);
      }

      // Boutons d'action
      const clearBtn = getClearButton();
      expect(clearBtn.textContent).toBe(resources.fr.kiosk.maintenance.clear);
      expect(clearBtn.type).toBe('button');

      const submitBtn = getSubmitButton();
      expect(submitBtn.textContent).toBe(resources.fr.kiosk.maintenance.submit);
      expect(submitBtn.type).toBe('submit');

      const cancelBtn = getCancelButton();
      expect(cancelBtn.textContent).toBe(resources.fr.kiosk.maintenance.cancel);
      expect(cancelBtn.type).toBe('button');

      const errorDiv = getErrorDiv();
      expect(errorDiv.hidden).toBe(true);
      expect(errorDiv.getAttribute('role')).toBe('alert');
      expect(errorDiv.getAttribute('aria-live')).toBe('assertive');
    });
  });

  describe('bon PIN', () => {
    it('appelle verify(pin) et invoque onUnlock() lorsque le PIN est valide', async () => {
      const verify = vi.fn().mockResolvedValue(true);
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      // Saisie via clavier tactile : 1, 2, 3, 4
      getDigitButton('1').click();
      getDigitButton('2').click();
      getDigitButton('3').click();
      getDigitButton('4').click();

      const input = getPinInput();
      expect(input.value).toBe('1234');

      const submitBtn = getSubmitButton();
      submitBtn.click();

      // Attendre la résolution de la promesse verify
      await Promise.resolve();
      await Promise.resolve();

      expect(verify).toHaveBeenCalledTimes(1);
      expect(verify).toHaveBeenCalledWith('1234');
      expect(onUnlock).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();

      const errorDiv = getErrorDiv();
      expect(errorDiv.hidden).toBe(true);
      expect(errorDiv.textContent).toBe('');
      expect(input.getAttribute('aria-invalid')).toBeNull();
    });

    it('accepte un PIN long valide jusqu’à 12 chiffres', async () => {
      const verify = vi.fn().mockResolvedValue(true);
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      // Saisie de 12 chiffres : 123456789012
      const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2'];
      for (const d of digits) {
        getDigitButton(d).click();
      }

      const input = getPinInput();
      expect(input.value).toBe('123456789012');

      getSubmitButton().click();
      await Promise.resolve();
      await Promise.resolve();

      expect(verify).toHaveBeenCalledWith('123456789012');
      expect(onUnlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('mauvais PIN avec message', () => {
    it('affiche le message d’erreur i18n et n’appelle pas onUnlock lorsque verify renvoie false', async () => {
      const verify = vi.fn().mockResolvedValue(false);
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      // Saisie 0000
      getDigitButton('0').click();
      getDigitButton('0').click();
      getDigitButton('0').click();
      getDigitButton('0').click();

      getSubmitButton().click();
      await Promise.resolve();
      await Promise.resolve();

      expect(verify).toHaveBeenCalledTimes(1);
      expect(verify).toHaveBeenCalledWith('0000');
      expect(onUnlock).not.toHaveBeenCalled();

      const errorDiv = getErrorDiv();
      expect(errorDiv.hidden).toBe(false);
      expect(errorDiv.textContent).toBe(resources.fr.kiosk.maintenance.error);

      const input = getPinInput();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      // La saisie est réinitialisée pour permettre un nouvel essai
      expect(input.value).toBe('');
      expect(getSubmitButton().disabled).toBe(false);
    });

    it('gère une exception levée par verify en affichant l’erreur et en réactivant les boutons', async () => {
      const verify = vi.fn().mockRejectedValue(new Error('Network error'));
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      getDigitButton('4').click();
      getDigitButton('5').click();
      getDigitButton('6').click();
      getDigitButton('7').click();

      getSubmitButton().click();
      await Promise.resolve();
      await Promise.resolve();

      expect(verify).toHaveBeenCalledTimes(1);
      expect(onUnlock).not.toHaveBeenCalled();

      const errorDiv = getErrorDiv();
      expect(errorDiv.hidden).toBe(false);
      expect(errorDiv.textContent).toBe(resources.fr.kiosk.maintenance.error);
      expect(getSubmitButton().disabled).toBe(false);
    });
  });

  describe('annulation', () => {
    it('invoque onCancel() lors du clic sur le bouton Annuler', () => {
      const verify = vi.fn();
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      getDigitButton('1').click();
      getDigitButton('2').click();

      getCancelButton().click();

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(verify).not.toHaveBeenCalled();
      expect(onUnlock).not.toHaveBeenCalled();
    });

    it('invoque onCancel() lors de la pression sur la touche Échap (Escape)', () => {
      const verify = vi.fn();
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(verify).not.toHaveBeenCalled();
      expect(onUnlock).not.toHaveBeenCalled();
    });
  });

  describe('PIN trop court non envoyé', () => {
    it('n’appelle pas verify si le PIN compte 0 chiffre et affiche l’erreur i18n', async () => {
      const verify = vi.fn();
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      getSubmitButton().click();
      await Promise.resolve();

      expect(verify).not.toHaveBeenCalled();
      expect(onUnlock).not.toHaveBeenCalled();

      const errorDiv = getErrorDiv();
      expect(errorDiv.hidden).toBe(false);
      expect(errorDiv.textContent).toBe(resources.fr.kiosk.maintenance.tooShort);
      expect(getPinInput().getAttribute('aria-invalid')).toBe('true');
    });

    it('n’appelle pas verify si le PIN compte moins de 4 chiffres (ex. 3 chiffres)', async () => {
      const verify = vi.fn();
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      getDigitButton('7').click();
      getDigitButton('8').click();
      getDigitButton('9').click();

      getSubmitButton().click();
      await Promise.resolve();

      expect(verify).not.toHaveBeenCalled();
      expect(onUnlock).not.toHaveBeenCalled();

      const errorDiv = getErrorDiv();
      expect(errorDiv.hidden).toBe(false);
      expect(errorDiv.textContent).toBe(resources.fr.kiosk.maintenance.tooShort);
      expect(getPinInput().getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('fonction effacer et limitation de longueur', () => {
    it('supprime le dernier chiffre lors du clic sur Effacer', () => {
      const verify = vi.fn();
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      getDigitButton('1').click();
      getDigitButton('2').click();
      getDigitButton('3').click();

      const input = getPinInput();
      expect(input.value).toBe('123');

      getClearButton().click();
      expect(input.value).toBe('12');

      getClearButton().click();
      expect(input.value).toBe('1');

      getClearButton().click();
      expect(input.value).toBe('');

      // Clic supplémentaire sur champ vide ne produit pas d'erreur
      getClearButton().click();
      expect(input.value).toBe('');
    });

    it('ignore les chiffres au-delà de 12 caractères', () => {
      const verify = vi.fn();
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      for (let i = 0; i < 15; i += 1) {
        getDigitButton('9').click();
      }

      const input = getPinInput();
      expect(input.value).toBe('999999999999');
      expect(input.value.length).toBe(12);
    });
  });

  describe('anti-double soumission et désactivation pendant vérification', () => {
    it('désactive tous les boutons pendant l’appel à verify et affiche l’état de vérification', async () => {
      let resolveVerify: (valid: boolean) => void = () => {};
      const verifyPromise = new Promise<boolean>((resolve) => {
        resolveVerify = resolve;
      });
      const verify = vi.fn().mockReturnValue(verifyPromise);
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      getDigitButton('1').click();
      getDigitButton('2').click();
      getDigitButton('3').click();
      getDigitButton('4').click();

      const submitBtn = getSubmitButton();
      submitBtn.click();

      // Vérification immédiate : boutons désactivés et texte de soumission
      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toBe(resources.fr.kiosk.maintenance.submitting);
      expect(getClearButton().disabled).toBe(true);
      expect(getCancelButton().disabled).toBe(true);
      expect(getDigitButton('1').disabled).toBe(true);
      expect(getPinInput().disabled).toBe(true);

      // Deuxième clic pendant que c'est en cours : doit être ignoré
      submitBtn.click();
      getDigitButton('5').click();
      expect(verify).toHaveBeenCalledTimes(1);

      // Résolution de la promesse
      resolveVerify(true);
      await Promise.resolve();
      await Promise.resolve();

      expect(onUnlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('saisie clavier physique', () => {
    it('permet de saisir les chiffres et de valider avec la touche Entrée', async () => {
      const verify = vi.fn().mockResolvedValue(true);
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      // Touches clavier envoyées sur root
      root.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      root.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
      root.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
      root.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));

      const input = getPinInput();
      expect(input.value).toBe('1234');

      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();

      expect(verify).toHaveBeenCalledWith('1234');
      expect(onUnlock).toHaveBeenCalledTimes(1);
    });

    it('filtre les caractères non numériques saisis directement dans l’input', () => {
      const verify = vi.fn();
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'fr',
      });

      const input = getPinInput();
      input.value = '12ab34cd56';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(input.value).toBe('123456');
    });
  });

  describe('multilingue et RTL', () => {
    it('applique les traductions et dir="rtl" en arabe', async () => {
      const verify = vi.fn().mockResolvedValue(false);
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'ar',
      });

      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(root.getAttribute('lang')).toBe('ar');
      expect(root.getAttribute('dir')).toBe('rtl');

      const title = root.querySelector('#kiosk-maintenance-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.ar.kiosk.maintenance.title);
      }

      const submitBtn = getSubmitButton();
      expect(submitBtn.textContent).toBe(resources.ar.kiosk.maintenance.submit);

      const cancelBtn = getCancelButton();
      expect(cancelBtn.textContent).toBe(resources.ar.kiosk.maintenance.cancel);

      const clearBtn = getClearButton();
      expect(clearBtn.textContent).toBe(resources.ar.kiosk.maintenance.clear);

      // PIN trop court
      submitBtn.click();
      await Promise.resolve();

      const errorDiv = getErrorDiv();
      expect(errorDiv.textContent).toBe(resources.ar.kiosk.maintenance.tooShort);
    });

    it('applique les traductions et dir="ltr" en anglais', () => {
      const verify = vi.fn();
      const onUnlock = vi.fn();
      const onCancel = vi.fn();

      renderMaintenancePin(document, root, {
        verify,
        onUnlock,
        onCancel,
        lang: 'en',
      });

      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');

      const title = root.querySelector('#kiosk-maintenance-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.en.kiosk.maintenance.title);
      }

      expect(getSubmitButton().textContent).toBe(resources.en.kiosk.maintenance.submit);
      expect(getCancelButton().textContent).toBe(resources.en.kiosk.maintenance.cancel);
      expect(getClearButton().textContent).toBe(resources.en.kiosk.maintenance.clear);
    });
  });
});
