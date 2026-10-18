import { dir, resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';

import type { ScreenState } from './screen-state.js';

export type { ScreenState };

export type OnEnrollCallback = (code: string) => void | Promise<void>;

export interface RenderScreenHandlers {
  onEnroll?: OnEnrollCallback;
}

export type RenderScreenOptions = RenderScreenHandlers | OnEnrollCallback;

function extractOnEnroll(options?: RenderScreenOptions): OnEnrollCallback | undefined {
  if (typeof options === 'function') {
    return options;
  }
  if (typeof options === 'object') {
    return options.onEnroll;
  }
  return undefined;
}

/**
 * Rendu DOM des écrans d'état kiosque (F-66).
 *
 * Écrans gérés :
 * - UNAVAILABLE : plein écran neutre « Service momentanément indisponible »,
 *   sans aucun lien, visite ou navigation externe.
 * - LOADING : indicateur textuel accessible i18n (« Chargement... »).
 * - ENROLL : écran d'enrôlement avec champ de code (8 caractères, forcé en majuscules),
 *   bouton d'envoi accessible avec protection anti-double soumission, et rappel onEnroll(code).
 * - HOME : écran d'accueil (vidage du conteneur en attente de renderHome).
 */
export function renderScreen(
  doc: Document,
  root: HTMLElement,
  screen: ScreenState,
  lang: Lang,
  options?: RenderScreenOptions,
): void {
  const direction = dir(lang);
  doc.documentElement.setAttribute('dir', direction);
  doc.documentElement.setAttribute('lang', lang);
  root.setAttribute('dir', direction);
  root.setAttribute('lang', lang);

  root.replaceChildren();

  if (screen === 'HOME') {
    root.className = 'kiosk-screen-home';
    return;
  }

  if (screen === 'UNAVAILABLE') {
    root.className = 'kiosk-screen kiosk-screen-unavailable';

    const main = doc.createElement('main');
    main.className = 'kiosk-status-container';
    main.setAttribute('role', 'status');
    main.setAttribute('aria-live', 'polite');

    const message = doc.createElement('p');
    message.className = 'kiosk-unavailable-message';
    message.textContent = resources[lang].kiosk.unavailable;

    main.appendChild(message);
    root.appendChild(main);
    return;
  }

  if (screen === 'LOADING') {
    root.className = 'kiosk-screen kiosk-screen-loading';

    const main = doc.createElement('main');
    main.className = 'kiosk-status-container';
    main.setAttribute('role', 'status');
    main.setAttribute('aria-live', 'polite');

    const loadingText = doc.createElement('p');
    loadingText.className = 'kiosk-loading-text';
    loadingText.textContent = resources[lang].kiosk.loading;

    main.appendChild(loadingText);
    root.appendChild(main);
    return;
  }

  root.className = 'kiosk-screen kiosk-screen-enroll';

  const onEnroll = extractOnEnroll(options);

  const main = doc.createElement('main');
  main.className = 'kiosk-enroll-container';
  main.setAttribute('role', 'main');

  const card = doc.createElement('div');
  card.className = 'kiosk-enroll-card';

  const title = doc.createElement('h1');
  title.className = 'kiosk-enroll-title';
  title.textContent = resources[lang].kiosk.enroll.title;
  card.appendChild(title);

  const instruction = doc.createElement('p');
  instruction.className = 'kiosk-enroll-instruction';
  instruction.textContent = resources[lang].kiosk.enroll.instruction;
  card.appendChild(instruction);

  const form = doc.createElement('form');
  form.className = 'kiosk-enroll-form';
  form.noValidate = true;

  const group = doc.createElement('div');
  group.className = 'kiosk-enroll-group';

  const label = doc.createElement('label');
  label.className = 'kiosk-enroll-label';
  label.htmlFor = 'kiosk-enroll-code';
  label.textContent = resources[lang].kiosk.enroll.codeLabel;
  group.appendChild(label);

  const input = doc.createElement('input');
  input.id = 'kiosk-enroll-code';
  input.name = 'code';
  input.type = 'text';
  input.className = 'kiosk-enroll-input';
  input.maxLength = 8;
  input.autocomplete = 'off';
  input.autocapitalize = 'characters';
  input.spellcheck = false;
  input.placeholder = resources[lang].kiosk.enroll.codePlaceholder;
  input.setAttribute('aria-required', 'true');
  input.setAttribute('aria-describedby', 'kiosk-enroll-error');
  group.appendChild(input);

  const errorDiv = doc.createElement('div');
  errorDiv.id = 'kiosk-enroll-error';
  errorDiv.className = 'kiosk-enroll-error';
  errorDiv.setAttribute('role', 'alert');
  errorDiv.setAttribute('aria-live', 'assertive');
  errorDiv.hidden = true;
  group.appendChild(errorDiv);

  form.appendChild(group);

  const submitBtn = doc.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'kiosk-enroll-btn';
  submitBtn.setAttribute('data-testid', 'kiosk-enroll-submit');
  submitBtn.textContent = resources[lang].kiosk.enroll.submit;
  form.appendChild(submitBtn);

  card.appendChild(form);
  main.appendChild(card);
  root.appendChild(main);

  input.addEventListener('input', () => {
    const upper = input.value.toUpperCase();
    if (input.value !== upper) {
      input.value = upper;
    }
    if (!errorDiv.hidden) {
      errorDiv.hidden = true;
      errorDiv.textContent = '';
      input.removeAttribute('aria-invalid');
    }
  });

  let isSubmitting = false;

  function handleEnrollSubmit(): void {
    if (isSubmitting) {
      return;
    }

    const code = input.value.trim().toUpperCase();
    const isValid = /^[A-Z0-9]{8}$/.test(code);

    if (!isValid) {
      errorDiv.hidden = false;
      errorDiv.textContent = resources[lang].kiosk.enroll.invalidCode;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }

    errorDiv.hidden = true;
    errorDiv.textContent = '';
    input.removeAttribute('aria-invalid');

    if (onEnroll === undefined) {
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    input.disabled = true;
    submitBtn.textContent = resources[lang].kiosk.enroll.submitting;

    try {
      const result = onEnroll(code);
      if (result instanceof Promise) {
        result
          .catch((err: unknown) => {
            const message =
              err instanceof Error && err.message.length > 0
                ? err.message
                : resources[lang].common.error.generic;
            errorDiv.hidden = false;
            errorDiv.textContent = message;
            input.setAttribute('aria-invalid', 'true');
          })
          .finally(() => {
            isSubmitting = false;
            submitBtn.disabled = false;
            input.disabled = false;
            submitBtn.textContent = resources[lang].kiosk.enroll.submit;
          });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.length > 0
          ? err.message
          : resources[lang].common.error.generic;
      errorDiv.hidden = false;
      errorDiv.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      isSubmitting = false;
      submitBtn.disabled = false;
      input.disabled = false;
      submitBtn.textContent = resources[lang].kiosk.enroll.submit;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleEnrollSubmit();
  });

  submitBtn.addEventListener('click', (event) => {
    if (!form.isConnected) {
      event.preventDefault();
      handleEnrollSubmit();
    }
  });
}
