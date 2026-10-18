import { resources } from '@xplor/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  renderMaintenanceStatus,
  type RenderMaintenanceStatusOptions,
} from './render-maintenance-status.js';

describe('renderMaintenanceStatus (F-67)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    vi.restoreAllMocks();
  });

  function getForceSyncButton(): HTMLButtonElement {
    const btn = root.querySelector('button[data-testid="kiosk-status-force-sync"]');
    expect(btn).toBeInstanceOf(HTMLButtonElement);
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error('Bouton Forcer la synchronisation introuvable');
    }
    return btn;
  }

  function getReenrollButton(): HTMLButtonElement {
    const btn = root.querySelector('button[data-testid="kiosk-status-reenroll"]');
    expect(btn).toBeInstanceOf(HTMLButtonElement);
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error('Bouton Réenrôler introuvable');
    }
    return btn;
  }

  function getCloseButton(): HTMLButtonElement {
    const btn = root.querySelector('button[data-testid="kiosk-status-close"]');
    expect(btn).toBeInstanceOf(HTMLButtonElement);
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error('Bouton Fermer introuvable');
    }
    return btn;
  }

  function getAppVersionElement(): HTMLElement {
    const el = root.querySelector('[data-testid="kiosk-status-app-version"]');
    expect(el).toBeInstanceOf(HTMLElement);
    if (!(el instanceof HTMLElement)) {
      throw new Error('Élément version app introuvable');
    }
    return el;
  }

  function getManifestVersionElement(): HTMLElement {
    const el = root.querySelector('[data-testid="kiosk-status-manifest-version"]');
    expect(el).toBeInstanceOf(HTMLElement);
    if (!(el instanceof HTMLElement)) {
      throw new Error('Élément version manifeste introuvable');
    }
    return el;
  }

  function getLastSyncElement(): HTMLElement {
    const el = root.querySelector('[data-testid="kiosk-status-last-sync"]');
    expect(el).toBeInstanceOf(HTMLElement);
    if (!(el instanceof HTMLElement)) {
      throw new Error('Élément dernière synchronisation introuvable');
    }
    return el;
  }

  function getSyncStateElement(): HTMLElement {
    const el = root.querySelector('[data-testid="kiosk-status-sync-state"]');
    expect(el).toBeInstanceOf(HTMLElement);
    if (!(el instanceof HTMLElement)) {
      throw new Error('Élément état de synchronisation introuvable');
    }
    return el;
  }

  function getFailedToursElement(): HTMLElement {
    const el = root.querySelector('[data-testid="kiosk-status-failed-tours"]');
    expect(el).toBeInstanceOf(HTMLElement);
    if (!(el instanceof HTMLElement)) {
      throw new Error('Élément visites en échec introuvable');
    }
    return el;
  }

  function createDefaultOptions(
    overrides: Partial<RenderMaintenanceStatusOptions> = {},
  ): RenderMaintenanceStatusOptions {
    return {
      appVersion: '1.4.2',
      syncedManifestVersion: 'manifest-2026-10-18',
      lastSyncAt: new Date('2026-10-18T08:30:00Z'),
      failedTours: [],
      lang: 'fr',
      onForceSync: vi.fn(),
      onReenroll: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
  }

  describe('affichage des valeurs', () => {
    it('affiche la version de l’application, du manifeste synchronisé et de la dernière synchronisation', () => {
      const lastSyncDate = new Date('2026-10-18T10:15:00Z');
      const options = createDefaultOptions({
        appVersion: '2.0.0',
        syncedManifestVersion: 'v42-rabat',
        lastSyncAt: lastSyncDate,
        failedTours: [],
      });

      renderMaintenanceStatus(document, root, options);

      expect(getAppVersionElement().textContent).toBe('2.0.0');
      expect(getManifestVersionElement().textContent).toBe('v42-rabat');

      const lastSyncEl = getLastSyncElement();
      expect(lastSyncEl.textContent).toBe(lastSyncDate.toLocaleString('fr'));
      const timeTag = lastSyncEl.querySelector('time');
      expect(timeTag).toBeInstanceOf(HTMLTimeElement);
      if (timeTag instanceof HTMLTimeElement) {
        expect(timeTag.dateTime).toBe(lastSyncDate.toISOString());
      }
    });

    it('affiche la valeur de repli traduite quand le manifeste synchronisé est null', () => {
      const options = createDefaultOptions({
        syncedManifestVersion: null,
      });

      renderMaintenanceStatus(document, root, options);

      expect(getManifestVersionElement().textContent).toBe(resources.fr.kiosk.maintenance.none);
    });

    it('affiche la valeur de repli traduite « Jamais » quand lastSyncAt est null', () => {
      const options = createDefaultOptions({
        lastSyncAt: null,
      });

      renderMaintenanceStatus(document, root, options);

      expect(getLastSyncElement().textContent).toBe(resources.fr.kiosk.maintenance.never);
    });

    it('affiche l’état de synchronisation avec badge succès et message vide quand aucune visite n’a échoué', () => {
      const options = createDefaultOptions({
        failedTours: [],
      });

      renderMaintenanceStatus(document, root, options);

      const syncStateEl = getSyncStateElement();
      const badge = syncStateEl.querySelector('.kiosk-status-badge');
      expect(badge).toBeInstanceOf(HTMLElement);
      if (badge instanceof HTMLElement) {
        expect(badge.classList.contains('kiosk-status-badge-success')).toBe(true);
        expect(badge.textContent).toBe(resources.fr.kiosk.maintenance.syncStatusSuccess);
      }

      const failedToursEl = getFailedToursElement();
      expect(failedToursEl.textContent).toContain(resources.fr.kiosk.maintenance.noFailedTours);
      expect(failedToursEl.querySelector('ul')).toBeNull();
    });

    it('affiche l’état de synchronisation en erreur et la liste des identifiants des visites en échec', () => {
      const failed = ['tour-kasbah-oudayas', 'tour-hassan-tower', 'tour-chellah'];
      const options = createDefaultOptions({
        failedTours: failed,
      });

      renderMaintenanceStatus(document, root, options);

      const syncStateEl = getSyncStateElement();
      const badge = syncStateEl.querySelector('.kiosk-status-badge');
      expect(badge).toBeInstanceOf(HTMLElement);
      if (badge instanceof HTMLElement) {
        expect(badge.classList.contains('kiosk-status-badge-error')).toBe(true);
        expect(badge.textContent).toBe(resources.fr.kiosk.maintenance.syncStatusError);
      }

      const failedToursEl = getFailedToursElement();
      const items = failedToursEl.querySelectorAll('li[data-testid="kiosk-status-failed-tour-item"]');
      expect(items.length).toBe(3);
      for (let i = 0; i < failed.length; i += 1) {
        const item = items[i];
        expect(item).toBeInstanceOf(HTMLLIElement);
        if (item instanceof HTMLLIElement) {
          expect(item.textContent).toBe(failed[i]);
          expect(item.getAttribute('data-tour-id')).toBe(failed[i]);
        }
      }
    });

    it('applique le texte et dir="rtl" en arabe', () => {
      const options = createDefaultOptions({
        lang: 'ar',
        syncedManifestVersion: null,
        lastSyncAt: null,
        failedTours: [],
      });

      renderMaintenanceStatus(document, root, options);

      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(root.getAttribute('dir')).toBe('rtl');
      expect(root.getAttribute('lang')).toBe('ar');

      const title = root.querySelector('#kiosk-maintenance-status-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.ar.kiosk.maintenance.statusTitle);
      }

      expect(getManifestVersionElement().textContent).toBe(resources.ar.kiosk.maintenance.none);
      expect(getLastSyncElement().textContent).toBe(resources.ar.kiosk.maintenance.never);
      expect(getForceSyncButton().textContent).toBe(resources.ar.kiosk.maintenance.forceSync);
      expect(getReenrollButton().textContent).toBe(resources.ar.kiosk.maintenance.reenroll);
      expect(getCloseButton().textContent).toBe(resources.ar.kiosk.maintenance.close);
    });

    it('applique le texte et dir="ltr" en anglais', () => {
      const options = createDefaultOptions({
        lang: 'en',
        syncedManifestVersion: null,
        lastSyncAt: null,
        failedTours: [],
      });

      renderMaintenanceStatus(document, root, options);

      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(root.getAttribute('dir')).toBe('ltr');
      expect(root.getAttribute('lang')).toBe('en');

      const title = root.querySelector('#kiosk-maintenance-status-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.en.kiosk.maintenance.statusTitle);
      }

      expect(getManifestVersionElement().textContent).toBe(resources.en.kiosk.maintenance.none);
      expect(getLastSyncElement().textContent).toBe(resources.en.kiosk.maintenance.never);
      expect(getForceSyncButton().textContent).toBe(resources.en.kiosk.maintenance.forceSync);
      expect(getReenrollButton().textContent).toBe(resources.en.kiosk.maintenance.reenroll);
      expect(getCloseButton().textContent).toBe(resources.en.kiosk.maintenance.close);
    });
  });

  describe('actions et callbacks', () => {
    it('appelle onForceSync lors du clic sur le bouton Forcer la synchronisation', () => {
      const onForceSync = vi.fn();
      const options = createDefaultOptions({ onForceSync });

      renderMaintenanceStatus(document, root, options);

      const btn = getForceSyncButton();
      expect(onForceSync).not.toHaveBeenCalled();

      btn.click();

      expect(onForceSync).toHaveBeenCalledTimes(1);
    });

    it('appelle onClose lors du clic sur le bouton Fermer', () => {
      const onClose = vi.fn();
      const options = createDefaultOptions({ onClose });

      renderMaintenanceStatus(document, root, options);

      const btn = getCloseButton();
      expect(onClose).not.toHaveBeenCalled();

      btn.click();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('appelle onClose lors de l’appui sur la touche Échap (Escape)', () => {
      const onClose = vi.fn();
      const options = createDefaultOptions({ onClose });

      renderMaintenanceStatus(document, root, options);

      expect(onClose).not.toHaveBeenCalled();

      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('appelle confirmFn avec le message i18n et déclenche onReenroll si confirmFn renvoie true', () => {
      const onReenroll = vi.fn();
      const confirmFn = vi.fn().mockReturnValue(true);
      const options = createDefaultOptions({ onReenroll, confirmFn });

      renderMaintenanceStatus(document, root, options);

      const btn = getReenrollButton();
      expect(confirmFn).not.toHaveBeenCalled();
      expect(onReenroll).not.toHaveBeenCalled();

      btn.click();

      expect(confirmFn).toHaveBeenCalledTimes(1);
      expect(confirmFn).toHaveBeenCalledWith(resources.fr.kiosk.maintenance.confirmReenroll);
      expect(onReenroll).toHaveBeenCalledTimes(1);
    });

    it('annule le réenrôlement et n’appelle pas onReenroll si confirmFn renvoie false', () => {
      const onReenroll = vi.fn();
      const confirmFn = vi.fn().mockReturnValue(false);
      const options = createDefaultOptions({ onReenroll, confirmFn });

      renderMaintenanceStatus(document, root, options);

      const btn = getReenrollButton();
      btn.click();

      expect(confirmFn).toHaveBeenCalledTimes(1);
      expect(confirmFn).toHaveBeenCalledWith(resources.fr.kiosk.maintenance.confirmReenroll);
      expect(onReenroll).not.toHaveBeenCalled();
    });

    it('utilise window.confirm par défaut si confirmFn n’est pas fourni', () => {
      const onReenroll = vi.fn();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const options = createDefaultOptions({ onReenroll, confirmFn: undefined });

      renderMaintenanceStatus(document, root, options);

      const btn = getReenrollButton();
      btn.click();

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith(resources.fr.kiosk.maintenance.confirmReenroll);
      expect(onReenroll).toHaveBeenCalledTimes(1);
    });

    it('annule le réenrôlement avec window.confirm par défaut lorsque celui-ci renvoie false', () => {
      const onReenroll = vi.fn();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const options = createDefaultOptions({ onReenroll, confirmFn: undefined });

      renderMaintenanceStatus(document, root, options);

      const btn = getReenrollButton();
      btn.click();

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(onReenroll).not.toHaveBeenCalled();
    });

    it('accepte confirmFn en 4e paramètre optionnel de la fonction', () => {
      const onReenroll = vi.fn();
      const confirmFn = vi.fn().mockReturnValue(true);
      const options = createDefaultOptions({ onReenroll, confirmFn: undefined });

      renderMaintenanceStatus(document, root, options, confirmFn);

      const btn = getReenrollButton();
      btn.click();

      expect(confirmFn).toHaveBeenCalledTimes(1);
      expect(onReenroll).toHaveBeenCalledTimes(1);
    });
  });

  describe('protection anti-double envoi et gestion asynchrone', () => {
    it('désactive les boutons et affiche l’état de chargement pendant onForceSync asynchrone', async () => {
      let resolveSync: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolveSync = resolve;
      });
      const onForceSync = vi.fn().mockImplementation(() => pendingPromise);

      const options = createDefaultOptions({ onForceSync });
      renderMaintenanceStatus(document, root, options);

      const forceSyncBtn = getForceSyncButton();
      const reenrollBtn = getReenrollButton();
      const closeBtn = getCloseButton();

      expect(forceSyncBtn.disabled).toBe(false);
      expect(reenrollBtn.disabled).toBe(false);
      expect(closeBtn.disabled).toBe(false);
      expect(forceSyncBtn.textContent).toBe(resources.fr.kiosk.maintenance.forceSync);

      forceSyncBtn.click();

      // Pendant la synchronisation
      expect(forceSyncBtn.disabled).toBe(true);
      expect(reenrollBtn.disabled).toBe(true);
      expect(closeBtn.disabled).toBe(true);
      expect(forceSyncBtn.textContent).toBe(resources.fr.kiosk.maintenance.forceSyncing);

      // Un second clic pendant l'exécution est ignoré
      forceSyncBtn.click();
      expect(onForceSync).toHaveBeenCalledTimes(1);

      // Résolution
      resolveSync();
      await pendingPromise;

      expect(forceSyncBtn.disabled).toBe(false);
      expect(reenrollBtn.disabled).toBe(false);
      expect(closeBtn.disabled).toBe(false);
      expect(forceSyncBtn.textContent).toBe(resources.fr.kiosk.maintenance.forceSync);
    });

    it('réactive les boutons même si onForceSync rejette une erreur', async () => {
      const onForceSync = vi.fn().mockRejectedValue(new Error('Échec réseau'));
      const options = createDefaultOptions({ onForceSync });

      renderMaintenanceStatus(document, root, options);

      const forceSyncBtn = getForceSyncButton();
      forceSyncBtn.click();

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(forceSyncBtn.disabled).toBe(false);
      expect(forceSyncBtn.textContent).toBe(resources.fr.kiosk.maintenance.forceSync);
    });

    it('désactive les boutons pendant onReenroll asynchrone puis les réactive', async () => {
      let resolveReenroll: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolveReenroll = resolve;
      });
      const onReenroll = vi.fn().mockImplementation(() => pendingPromise);
      const confirmFn = vi.fn().mockReturnValue(true);

      const options = createDefaultOptions({ onReenroll, confirmFn });
      renderMaintenanceStatus(document, root, options);

      const reenrollBtn = getReenrollButton();
      reenrollBtn.click();

      expect(reenrollBtn.disabled).toBe(true);
      expect(getForceSyncButton().disabled).toBe(true);
      expect(getCloseButton().disabled).toBe(true);

      // Tentative de fermeture via Escape pendant l'exécution : ignorée
      const onClose = options.onClose;
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      resolveReenroll();
      await pendingPromise;

      expect(reenrollBtn.disabled).toBe(false);
      expect(getForceSyncButton().disabled).toBe(false);
      expect(getCloseButton().disabled).toBe(false);
    });
  });
});
