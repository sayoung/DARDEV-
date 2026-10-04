import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { confirmGoTo } from './confirm-dialog';

describe('confirmGoTo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const labels = {
    goTo: 'Aller vers : {{title}}',
    confirm: 'Confirmer',
    cancel: 'Annuler',
  };

  it('affiche le dialogue avec le titre échappé', async () => {
    const promise = confirmGoTo(document, '<b>Kasbah des Oudayas</b>', labels);

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    const message = dialog?.querySelector('p');
    expect(message?.textContent).toBe('Aller vers : <b>Kasbah des Oudayas</b>');

    const cancelBtn = dialog?.querySelector('.confirm-dialog-btn-cancel');
    if (cancelBtn instanceof HTMLButtonElement) {
      cancelBtn.click();
    }
    await promise;
  });

  it('résout true au clic sur Confirmer et nettoie le DOM', async () => {
    const promise = confirmGoTo(document, 'Titre', labels);

    const confirmBtn = document.querySelector('.confirm-dialog-btn-confirm');
    if (confirmBtn instanceof HTMLButtonElement) {
      confirmBtn.click();
    }

    const result = await promise;
    expect(result).toBe(true);
    expect(document.querySelector('.confirm-dialog-backdrop')).toBeNull();
  });

  it('résout false au clic sur Annuler et nettoie le DOM', async () => {
    const promise = confirmGoTo(document, 'Titre', labels);

    const cancelBtn = document.querySelector('.confirm-dialog-btn-cancel');
    if (cancelBtn instanceof HTMLButtonElement) {
      cancelBtn.click();
    }

    const result = await promise;
    expect(result).toBe(false);
    expect(document.querySelector('.confirm-dialog-backdrop')).toBeNull();
  });

  it('résout false à l\'appui sur Échap et nettoie le DOM', async () => {
    const promise = confirmGoTo(document, 'Titre', labels);

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    const result = await promise;
    expect(result).toBe(false);
    expect(document.querySelector('.confirm-dialog-backdrop')).toBeNull();
  });

  it('donne le focus au bouton de confirmation initialement', () => {
    void confirmGoTo(document, 'Titre', labels);

    const confirmBtn = document.querySelector('.confirm-dialog-btn-confirm');
    expect(document.activeElement).toBe(confirmBtn);
  });
});
