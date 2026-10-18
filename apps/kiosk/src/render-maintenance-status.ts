import { dir, resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';

export type ConfirmFn = (message: string) => boolean;

export interface RenderMaintenanceStatusOptions {
  appVersion: string;
  syncedManifestVersion: string | null;
  lastSyncAt: Date | null;
  failedTours: string[];
  lang: Lang;
  onForceSync: () => void | Promise<void>;
  onReenroll: () => void | Promise<void>;
  onClose: () => void;
  confirmFn?: ConfirmFn;
}

/**
 * Rendu DOM de l'écran technique d'état et de maintenance du kiosque (F-67 2/2).
 *
 * Affiche :
 * - Version de l'application (`appVersion`).
 * - Version du manifeste synchronisé (`syncedManifestVersion` ou repli i18n).
 * - Date/heure de la dernière synchronisation (`lastSyncAt` ou repli i18n).
 * - État de la synchronisation (succès ou erreurs selon `failedTours`).
 * - Liste des visites en échec le cas échéant.
 * - Les trois actions de maintenance :
 *   1. Forcer la synchronisation (`onForceSync`) avec protection anti-double appel.
 *   2. Réenrôler (`onReenroll`) protégé par une confirmation via `confirmFn` (ou `window.confirm`).
 *   3. Fermer (`onClose`) accessible au clic et via la touche Échap.
 */
export function renderMaintenanceStatus(
  doc: Document,
  root: HTMLElement,
  options: RenderMaintenanceStatusOptions,
  maybeConfirmFn?: ConfirmFn,
): void {
  const {
    appVersion,
    syncedManifestVersion,
    lastSyncAt,
    failedTours,
    lang,
    onForceSync,
    onReenroll,
    onClose,
    confirmFn,
  } = options;

  const confirm: ConfirmFn =
    confirmFn ??
    maybeConfirmFn ??
    ((message: string): boolean => {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        return window.confirm(message);
      }
      return true;
    });

  const direction = dir(lang);
  doc.documentElement.setAttribute('dir', direction);
  doc.documentElement.setAttribute('lang', lang);
  root.setAttribute('dir', direction);
  root.setAttribute('lang', lang);
  root.className = 'kiosk-screen kiosk-screen-maintenance kiosk-screen-maintenance-status';

  root.replaceChildren();

  const main = doc.createElement('main');
  main.className = 'kiosk-maintenance-container kiosk-maintenance-status-container';
  main.setAttribute('role', 'main');
  main.setAttribute('aria-labelledby', 'kiosk-maintenance-status-title');

  const card = doc.createElement('div');
  card.className = 'kiosk-maintenance-card kiosk-maintenance-status-card';

  // Titre
  const title = doc.createElement('h1');
  title.id = 'kiosk-maintenance-status-title';
  title.className = 'kiosk-maintenance-title';
  title.textContent = resources[lang].kiosk.maintenance.statusTitle;
  card.appendChild(title);

  // Sous-titre
  const subtitle = doc.createElement('p');
  subtitle.className = 'kiosk-maintenance-subtitle';
  subtitle.textContent = resources[lang].kiosk.maintenance.statusSubtitle;
  card.appendChild(subtitle);

  // Liste descriptive des métadonnées système et statut
  const statusList = doc.createElement('dl');
  statusList.className = 'kiosk-status-list';

  // 1. Version de l'application
  const appVersionRow = doc.createElement('div');
  appVersionRow.className = 'kiosk-status-row';

  const appVersionDt = doc.createElement('dt');
  appVersionDt.className = 'kiosk-status-dt';
  appVersionDt.textContent = resources[lang].kiosk.maintenance.appVersion;
  appVersionRow.appendChild(appVersionDt);

  const appVersionDd = doc.createElement('dd');
  appVersionDd.className = 'kiosk-status-dd';
  appVersionDd.setAttribute('data-testid', 'kiosk-status-app-version');
  appVersionDd.textContent = appVersion;
  appVersionRow.appendChild(appVersionDd);

  statusList.appendChild(appVersionRow);

  // 2. Version du manifeste synchronisé
  const manifestRow = doc.createElement('div');
  manifestRow.className = 'kiosk-status-row';

  const manifestDt = doc.createElement('dt');
  manifestDt.className = 'kiosk-status-dt';
  manifestDt.textContent = resources[lang].kiosk.maintenance.manifestVersion;
  manifestRow.appendChild(manifestDt);

  const manifestDd = doc.createElement('dd');
  manifestDd.className = 'kiosk-status-dd';
  manifestDd.setAttribute('data-testid', 'kiosk-status-manifest-version');
  manifestDd.textContent =
    syncedManifestVersion !== null
      ? syncedManifestVersion
      : resources[lang].kiosk.maintenance.none;
  manifestRow.appendChild(manifestDd);

  statusList.appendChild(manifestRow);

  // 3. Dernière synchronisation
  const lastSyncRow = doc.createElement('div');
  lastSyncRow.className = 'kiosk-status-row';

  const lastSyncDt = doc.createElement('dt');
  lastSyncDt.className = 'kiosk-status-dt';
  lastSyncDt.textContent = resources[lang].kiosk.maintenance.lastSync;
  lastSyncRow.appendChild(lastSyncDt);

  const lastSyncDd = doc.createElement('dd');
  lastSyncDd.className = 'kiosk-status-dd';
  lastSyncDd.setAttribute('data-testid', 'kiosk-status-last-sync');
  if (lastSyncAt !== null) {
    const timeEl = doc.createElement('time');
    timeEl.dateTime = lastSyncAt.toISOString();
    timeEl.textContent = lastSyncAt.toLocaleString(lang);
    lastSyncDd.appendChild(timeEl);
  } else {
    lastSyncDd.textContent = resources[lang].kiosk.maintenance.never;
  }
  lastSyncRow.appendChild(lastSyncDd);

  statusList.appendChild(lastSyncRow);

  // 4. État global de synchronisation
  const syncStateRow = doc.createElement('div');
  syncStateRow.className = 'kiosk-status-row';

  const syncStateDt = doc.createElement('dt');
  syncStateDt.className = 'kiosk-status-dt';
  syncStateDt.textContent = resources[lang].kiosk.maintenance.syncStatus;
  syncStateRow.appendChild(syncStateDt);

  const syncStateDd = doc.createElement('dd');
  syncStateDd.className = 'kiosk-status-dd';
  syncStateDd.setAttribute('data-testid', 'kiosk-status-sync-state');

  const badge = doc.createElement('span');
  if (failedTours.length === 0) {
    badge.className = 'kiosk-status-badge kiosk-status-badge-success';
    badge.textContent = resources[lang].kiosk.maintenance.syncStatusSuccess;
  } else {
    badge.className = 'kiosk-status-badge kiosk-status-badge-error';
    badge.textContent = resources[lang].kiosk.maintenance.syncStatusError;
  }
  syncStateDd.appendChild(badge);
  syncStateRow.appendChild(syncStateDd);

  statusList.appendChild(syncStateRow);

  // 5. Visites en échec (le cas échéant)
  const failedToursRow = doc.createElement('div');
  failedToursRow.className = 'kiosk-status-row kiosk-status-row-failed';

  const failedToursDt = doc.createElement('dt');
  failedToursDt.className = 'kiosk-status-dt';
  failedToursDt.textContent = resources[lang].kiosk.maintenance.failedTours;
  failedToursRow.appendChild(failedToursDt);

  const failedToursDd = doc.createElement('dd');
  failedToursDd.className = 'kiosk-status-dd';
  failedToursDd.setAttribute('data-testid', 'kiosk-status-failed-tours');

  if (failedTours.length === 0) {
    const emptyNotice = doc.createElement('span');
    emptyNotice.className = 'kiosk-status-empty';
    emptyNotice.textContent = resources[lang].kiosk.maintenance.noFailedTours;
    failedToursDd.appendChild(emptyNotice);
  } else {
    const ul = doc.createElement('ul');
    ul.className = 'kiosk-status-failed-list';
    for (const tourId of failedTours) {
      const li = doc.createElement('li');
      li.className = 'kiosk-status-failed-item';
      li.setAttribute('data-testid', 'kiosk-status-failed-tour-item');
      li.setAttribute('data-tour-id', tourId);
      li.textContent = tourId;
      ul.appendChild(li);
    }
    failedToursDd.appendChild(ul);
  }
  failedToursRow.appendChild(failedToursDd);

  statusList.appendChild(failedToursRow);

  card.appendChild(statusList);

  // 6. Groupe d'actions
  const actionsGroup = doc.createElement('div');
  actionsGroup.className = 'kiosk-status-actions';
  actionsGroup.setAttribute('role', 'group');
  actionsGroup.setAttribute('aria-label', resources[lang].kiosk.maintenance.actions);

  // Bouton 1 : Forcer la synchronisation
  const forceSyncBtn = doc.createElement('button');
  forceSyncBtn.type = 'button';
  forceSyncBtn.className = 'kiosk-btn kiosk-btn-primary kiosk-status-btn-force-sync';
  forceSyncBtn.setAttribute('data-testid', 'kiosk-status-force-sync');
  forceSyncBtn.setAttribute('aria-label', resources[lang].kiosk.maintenance.forceSync);
  forceSyncBtn.textContent = resources[lang].kiosk.maintenance.forceSync;
  actionsGroup.appendChild(forceSyncBtn);

  // Bouton 2 : Réenrôler (avec confirmation)
  const reenrollBtn = doc.createElement('button');
  reenrollBtn.type = 'button';
  reenrollBtn.className = 'kiosk-btn kiosk-btn-destructive kiosk-status-btn-reenroll';
  reenrollBtn.setAttribute('data-testid', 'kiosk-status-reenroll');
  reenrollBtn.setAttribute('aria-label', resources[lang].kiosk.maintenance.reenroll);
  reenrollBtn.textContent = resources[lang].kiosk.maintenance.reenroll;
  actionsGroup.appendChild(reenrollBtn);

  // Bouton 3 : Fermer
  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kiosk-btn kiosk-btn-secondary kiosk-status-btn-close';
  closeBtn.setAttribute('data-testid', 'kiosk-status-close');
  closeBtn.setAttribute('aria-label', resources[lang].kiosk.maintenance.close);
  closeBtn.textContent = resources[lang].kiosk.maintenance.close;
  actionsGroup.appendChild(closeBtn);

  card.appendChild(actionsGroup);
  main.appendChild(card);
  root.appendChild(main);

  let isBusy = false;

  function setControlsDisabled(disabled: boolean): void {
    forceSyncBtn.disabled = disabled;
    reenrollBtn.disabled = disabled;
    closeBtn.disabled = disabled;
  }

  async function handleForceSync(): Promise<void> {
    if (isBusy) {
      return;
    }
    isBusy = true;
    setControlsDisabled(true);
    forceSyncBtn.textContent = resources[lang].kiosk.maintenance.forceSyncing;
    try {
      await onForceSync();
    } catch {
      // Maintient la stabilité du kiosque en cas d'échec de la synchronisation forcée
    } finally {
      isBusy = false;
      setControlsDisabled(false);
      forceSyncBtn.textContent = resources[lang].kiosk.maintenance.forceSync;
    }
  }

  async function handleReenroll(): Promise<void> {
    if (isBusy) {
      return;
    }
    const confirmed = confirm(resources[lang].kiosk.maintenance.confirmReenroll);
    if (!confirmed) {
      return;
    }
    isBusy = true;
    setControlsDisabled(true);
    try {
      await onReenroll();
    } catch {
      // Maintient la stabilité du kiosque en cas d'échec du réenrôlement
    } finally {
      isBusy = false;
      setControlsDisabled(false);
    }
  }

  function handleClose(): void {
    if (isBusy) {
      return;
    }
    onClose();
  }

  forceSyncBtn.addEventListener('click', () => {
    void handleForceSync();
  });

  reenrollBtn.addEventListener('click', () => {
    void handleReenroll();
  });

  closeBtn.addEventListener('click', () => {
    handleClose();
  });

  // Accessibilité clavier : touche Échap pour fermer l'écran
  root.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (!isBusy) {
        event.preventDefault();
        handleClose();
      }
    }
  });
}
