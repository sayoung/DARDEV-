import { dir, resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';

import type { MaintenancePinVerifier } from './maintenance-pin.js';

export type { MaintenancePinVerifier };

export interface RenderMaintenancePinOptions {
  verify: MaintenancePinVerifier;
  onUnlock: () => void;
  onCancel: () => void;
  lang: Lang;
}


/**
 * Rendu DOM de l'écran technique de maintenance et saisie du code PIN (F-67).
 *
 * Fonctionnalités :
 * - Clavier numérique tactile (touches 0-9, effacer, valider).
 * - Saisie masquée de 4 à 12 chiffres (champ password accessible).
 * - Bouton annuler et support de la touche Échap.
 * - Protection anti-double soumission et désactivation des contrôles pendant la vérification.
 * - Message d'erreur i18n si le vérificateur renvoie false ou rejette.
 * - Appel de onUnlock() si le code PIN est valide (true).
 * - Contrôle de longueur minimale (4 chiffres) : aucun appel vers verify si le code est trop court.
 */
export function renderMaintenancePin(
  doc: Document,
  root: HTMLElement,
  { verify, onUnlock, onCancel, lang }: RenderMaintenancePinOptions,
): void {
  const direction = dir(lang);
  doc.documentElement.setAttribute('dir', direction);
  doc.documentElement.setAttribute('lang', lang);
  root.setAttribute('dir', direction);
  root.setAttribute('lang', lang);
  root.className = 'kiosk-screen kiosk-screen-maintenance';

  root.replaceChildren();

  const main = doc.createElement('main');
  main.className = 'kiosk-maintenance-container';
  main.setAttribute('role', 'dialog');
  main.setAttribute('aria-modal', 'true');
  main.setAttribute('aria-labelledby', 'kiosk-maintenance-title');

  const card = doc.createElement('div');
  card.className = 'kiosk-maintenance-card';

  const title = doc.createElement('h1');
  title.id = 'kiosk-maintenance-title';
  title.className = 'kiosk-maintenance-title';
  title.textContent = resources[lang].kiosk.maintenance.title;
  card.appendChild(title);

  const subtitle = doc.createElement('p');
  subtitle.className = 'kiosk-maintenance-subtitle';
  subtitle.textContent = resources[lang].kiosk.maintenance.subtitle;
  card.appendChild(subtitle);

  const form = doc.createElement('form');
  form.className = 'kiosk-maintenance-form';
  form.noValidate = true;

  const field = doc.createElement('div');
  field.className = 'kiosk-pin-field';

  const label = doc.createElement('label');
  label.className = 'kiosk-pin-label';
  label.htmlFor = 'kiosk-pin-input';
  label.textContent = resources[lang].kiosk.maintenance.pinLabel;
  field.appendChild(label);

  const input = doc.createElement('input');
  input.id = 'kiosk-pin-input';
  input.name = 'pin';
  input.type = 'password';
  input.className = 'kiosk-pin-input';
  input.maxLength = 12;
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.inputMode = 'numeric';
  input.pattern = '[0-9]*';
  input.placeholder = resources[lang].kiosk.maintenance.pinPlaceholder;
  input.setAttribute('aria-required', 'true');
  input.setAttribute('aria-describedby', 'kiosk-pin-error');
  field.appendChild(input);

  const errorDiv = doc.createElement('div');
  errorDiv.id = 'kiosk-pin-error';
  errorDiv.className = 'kiosk-pin-error';
  errorDiv.setAttribute('role', 'alert');
  errorDiv.setAttribute('aria-live', 'assertive');
  errorDiv.hidden = true;
  field.appendChild(errorDiv);

  form.appendChild(field);

  // Clavier numérique tactile
  const keypad = doc.createElement('div');
  keypad.className = 'kiosk-pin-keypad';
  keypad.setAttribute('role', 'group');
  keypad.setAttribute('aria-label', resources[lang].kiosk.maintenance.keypadLabel);

  const digitButtons: HTMLButtonElement[] = [];

  function createDigitButton(digit: string): HTMLButtonElement {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'kiosk-pin-btn kiosk-pin-digit-btn';
    btn.setAttribute('data-digit', digit);
    btn.setAttribute('data-testid', `kiosk-pin-digit-${digit}`);
    btn.setAttribute('aria-label', digit);
    btn.textContent = digit;
    btn.addEventListener('click', () => {
      appendDigit(digit);
    });
    digitButtons.push(btn);
    return btn;
  }

  // Ligne 1 : 1, 2, 3
  keypad.appendChild(createDigitButton('1'));
  keypad.appendChild(createDigitButton('2'));
  keypad.appendChild(createDigitButton('3'));

  // Ligne 2 : 4, 5, 6
  keypad.appendChild(createDigitButton('4'));
  keypad.appendChild(createDigitButton('5'));
  keypad.appendChild(createDigitButton('6'));

  // Ligne 3 : 7, 8, 9
  keypad.appendChild(createDigitButton('7'));
  keypad.appendChild(createDigitButton('8'));
  keypad.appendChild(createDigitButton('9'));

  // Ligne 4 : Effacer, 0, Valider
  const clearBtn = doc.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'kiosk-pin-btn kiosk-pin-action-btn kiosk-pin-clear-btn';
  clearBtn.setAttribute('data-action', 'clear');
  clearBtn.setAttribute('data-testid', 'kiosk-pin-clear');
  clearBtn.setAttribute('aria-label', resources[lang].kiosk.maintenance.clear);
  clearBtn.textContent = resources[lang].kiosk.maintenance.clear;
  clearBtn.addEventListener('click', () => {
    clearLastDigit();
  });
  keypad.appendChild(clearBtn);

  keypad.appendChild(createDigitButton('0'));

  const submitBtn = doc.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'kiosk-pin-btn kiosk-pin-action-btn kiosk-pin-submit-btn';
  submitBtn.setAttribute('data-action', 'submit');
  submitBtn.setAttribute('data-testid', 'kiosk-pin-submit');
  submitBtn.setAttribute('aria-label', resources[lang].kiosk.maintenance.submit);
  submitBtn.textContent = resources[lang].kiosk.maintenance.submit;
  keypad.appendChild(submitBtn);

  form.appendChild(keypad);

  // Actions (Bouton Annuler)
  const actionsDiv = doc.createElement('div');
  actionsDiv.className = 'kiosk-pin-actions';

  const cancelBtn = doc.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'kiosk-pin-btn kiosk-pin-cancel-btn';
  cancelBtn.setAttribute('data-action', 'cancel');
  cancelBtn.setAttribute('data-testid', 'kiosk-pin-cancel');
  cancelBtn.setAttribute('aria-label', resources[lang].kiosk.maintenance.cancel);
  cancelBtn.textContent = resources[lang].kiosk.maintenance.cancel;
  cancelBtn.addEventListener('click', () => {
    handleCancel();
  });
  actionsDiv.appendChild(cancelBtn);

  form.appendChild(actionsDiv);
  card.appendChild(form);
  main.appendChild(card);
  root.appendChild(main);

  let currentPin = '';
  let isVerifying = false;

  function setControlsDisabled(disabled: boolean): void {
    input.disabled = disabled;
    clearBtn.disabled = disabled;
    submitBtn.disabled = disabled;
    cancelBtn.disabled = disabled;
    for (const btn of digitButtons) {
      btn.disabled = disabled;
    }
  }

  function appendDigit(digit: string): void {
    if (isVerifying) {
      return;
    }
    if (currentPin.length >= 12) {
      return;
    }
    currentPin += digit;
    input.value = currentPin;
    if (!errorDiv.hidden) {
      errorDiv.hidden = true;
      errorDiv.textContent = '';
      input.removeAttribute('aria-invalid');
    }
  }

  function clearLastDigit(): void {
    if (isVerifying) {
      return;
    }
    if (currentPin.length > 0) {
      currentPin = currentPin.slice(0, -1);
      input.value = currentPin;
    }
    if (!errorDiv.hidden) {
      errorDiv.hidden = true;
      errorDiv.textContent = '';
      input.removeAttribute('aria-invalid');
    }
  }

  function handleCancel(): void {
    if (isVerifying) {
      return;
    }
    currentPin = '';
    input.value = '';
    onCancel();
  }

  async function handleSubmit(): Promise<void> {
    if (isVerifying) {
      return;
    }

    const pin = currentPin.trim();
    if (pin.length < 4 || pin.length > 12 || !/^\d{4,12}$/.test(pin)) {
      errorDiv.hidden = false;
      errorDiv.textContent = resources[lang].kiosk.maintenance.tooShort;
      input.setAttribute('aria-invalid', 'true');
      return;
    }

    isVerifying = true;
    setControlsDisabled(true);
    submitBtn.textContent = resources[lang].kiosk.maintenance.submitting;
    errorDiv.hidden = true;
    errorDiv.textContent = '';
    input.removeAttribute('aria-invalid');

    try {
      const isValid = await verify(pin);
      if (isValid) {
        currentPin = '';
        input.value = '';
        onUnlock();
        return;
      }
      errorDiv.hidden = false;
      errorDiv.textContent = resources[lang].kiosk.maintenance.error;
      input.setAttribute('aria-invalid', 'true');
      currentPin = '';
      input.value = '';
    } catch {
      errorDiv.hidden = false;
      errorDiv.textContent = resources[lang].kiosk.maintenance.error;
      input.setAttribute('aria-invalid', 'true');
      currentPin = '';
      input.value = '';
    } finally {
      isVerifying = false;
      setControlsDisabled(false);
      submitBtn.textContent = resources[lang].kiosk.maintenance.submit;
    }
  }

  input.addEventListener('input', () => {
    if (isVerifying) {
      input.value = currentPin;
      return;
    }
    const digitsOnly = input.value.replace(/\D/g, '').slice(0, 12);
    currentPin = digitsOnly;
    if (input.value !== currentPin) {
      input.value = currentPin;
    }
    if (!errorDiv.hidden) {
      errorDiv.hidden = true;
      errorDiv.textContent = '';
      input.removeAttribute('aria-invalid');
    }
  });

  form.addEventListener('submit', (event: SubmitEvent) => {
    event.preventDefault();
    void handleSubmit();
  });

  submitBtn.addEventListener('click', (event: MouseEvent) => {
    event.preventDefault();
    void handleSubmit();
  });

  // Accessibilité clavier
  root.addEventListener('keydown', (event: KeyboardEvent) => {
    if (isVerifying) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
      return;
    }
    if (event.key >= '0' && event.key <= '9') {
      if (doc.activeElement !== input) {
        event.preventDefault();
        appendDigit(event.key);
      }
      return;
    }
    if (event.key === 'Backspace') {
      if (doc.activeElement !== input) {
        event.preventDefault();
        clearLastDigit();
      }
      return;
    }
    if (event.key === 'Enter') {
      if (doc.activeElement !== input) {
        event.preventDefault();
        void handleSubmit();
      }
      return;
    }
  });
}
