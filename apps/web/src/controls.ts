import type { LocalizedText, TourGraphScene } from '@xplor/shared';
import { groupScenesIntoPlaces } from './places.js';

export type ControlsScene = TourGraphScene | (Omit<TourGraphScene, 'title'> & { title: LocalizedText });

export interface ControlsLabels {
  nav?: string;
  previous: string;
  next: string;
  back: string;
  fullscreen: string;
  practicalInfo: string;
  gyroscope?: string;
  places?: string;
  placesTitle?: string;
}

export interface ControlsHandlers {
  onPrevious(): void;
  onNext(): void;
  onBack(): void;
  onFullscreen(): void;
  onPracticalInfo(): void;
  onGyroscope?(): void;
  goToScene?: (sceneId: string) => void;
}

export interface ControlsOptions {
  scenes?: readonly ControlsScene[];
  goToScene?: (sceneId: string) => void;
  lang?: string;
}

export interface ControlsState {
  previous: string | null;
  next: string | null;
  canGoBack: boolean;
  hasPracticalInfo: boolean;
  currentSceneId?: string | null;
  sceneId?: string | null;
  current?: string | null;
  scenes?: readonly ControlsScene[];
}

const PLACES_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>';

function isControlsOptions(val: unknown): val is ControlsOptions {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function createControls(
  doc: Document,
  labels: ControlsLabels,
  handlers: ControlsHandlers,
  scenesOrOptions?: readonly ControlsScene[] | ControlsOptions,
  maybeGoToScene?: (sceneId: string) => void
): {
  update(state: ControlsState): void;
  showGyroscope(visible: boolean): void;
  setVrActive(active: boolean): void;
  destroy(): void;
} {
  let currentScenes: readonly ControlsScene[] | undefined;
  let activeGoToScene: ((sceneId: string) => void) | undefined;
  if (typeof handlers.goToScene === 'function') {
    activeGoToScene = (sceneId: string) => {
      handlers.goToScene?.(sceneId);
    };
  }
  let preferredLang = 'fr';

  const docLang = doc.documentElement.lang;
  if (typeof docLang === 'string' && docLang.length > 0) {
    preferredLang = docLang;
  }

  if (Array.isArray(scenesOrOptions)) {
    currentScenes = scenesOrOptions;
    if (typeof maybeGoToScene === 'function') {
      activeGoToScene = (sceneId: string) => {
        maybeGoToScene(sceneId);
      };
    }
  } else if (isControlsOptions(scenesOrOptions)) {
    if (Array.isArray(scenesOrOptions.scenes)) {
      currentScenes = scenesOrOptions.scenes;
    }
    if (typeof scenesOrOptions.goToScene === 'function') {
      const fn = scenesOrOptions.goToScene;
      activeGoToScene = (sceneId: string) => {
        fn(sceneId);
      };
    } else if (typeof maybeGoToScene === 'function') {
      activeGoToScene = (sceneId: string) => {
        maybeGoToScene(sceneId);
      };
    }
    if (typeof scenesOrOptions.lang === 'string' && scenesOrOptions.lang.length > 0) {
      preferredLang = scenesOrOptions.lang;
    }
  } else if (typeof maybeGoToScene === 'function') {
    activeGoToScene = (sceneId: string) => {
      maybeGoToScene(sceneId);
    };
  }

  let currentSceneId: string | null = null;
  if (currentScenes && currentScenes.length > 0) {
    const firstScene = currentScenes[0];
    if (firstScene && typeof firstScene.id === 'string') {
      currentSceneId = firstScene.id;
    }
  }

  const nav = doc.createElement('nav');
  nav.id = 'controls';
  nav.setAttribute('aria-label', labels.nav ?? 'Controls');

  const createButton = (label: string | undefined, text: string, handler: () => void) => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    if (label) btn.setAttribute('aria-label', label);
    btn.textContent = text;
    btn.addEventListener('click', handler);
    return btn;
  };

  const backBtn = createButton(labels.back, '↩', () => { handlers.onBack(); });
  // Bouton Précédente ❮ : classe xplor-nav-btn--prev.
  // Couleur demandée #D64545 (contraste 4.38:1 < 4.5:1), assombrie à #d24444 (contraste 4.52:1 ≥ 4.5:1) dans style.css.
  const prevBtn = createButton(labels.previous, '❮', () => { handlers.onPrevious(); });
  prevBtn.classList.add('xplor-nav-btn--prev');

  // Bouton Suivante ❯ : classe xplor-nav-btn--next.
  // Couleur demandée #1E9E4A (contraste 3.47:1 < 4.5:1), assombrie à #1a8840 (contraste 4.53:1 ≥ 4.5:1) dans style.css.
  const nextBtn = createButton(labels.next, '❯', () => { handlers.onNext(); });
  nextBtn.classList.add('xplor-nav-btn--next');
  const infoBtn = createButton(labels.practicalInfo, 'ℹ︎', () => { handlers.onPracticalInfo(); });
  const fsBtn = createButton(labels.fullscreen, '⛶', () => { handlers.onFullscreen(); });

  let gyroBtn: HTMLButtonElement | null = null;
  if (handlers.onGyroscope && labels.gyroscope) {
    gyroBtn = createButton(labels.gyroscope, '🧭', () => { handlers.onGyroscope?.(); });
    gyroBtn.hidden = true;
  }

  let isVrActive = false;
  let isPanelOpen = false;
  let openPanel: HTMLElement | null = null;
  let placesBtn: HTMLButtonElement | null = null;

  const closePlacesPanel = (restoreFocus = true) => {
    if (!isPanelOpen) return;
    isPanelOpen = false;
    if (placesBtn) {
      placesBtn.setAttribute('aria-expanded', 'false');
    }
    doc.removeEventListener('keydown', handlePanelKeydown);
    doc.removeEventListener('click', handleOutsideClick);

    if (openPanel) {
      openPanel.remove();
      openPanel = null;
    }

    if (restoreFocus && placesBtn && !placesBtn.hidden) {
      placesBtn.focus();
    }
  };

  const handleOutsideClick = (e: MouseEvent) => {
    if (!isPanelOpen || !openPanel) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (placesBtn && placesBtn.contains(target)) {
      return;
    }
    if (!openPanel.contains(target)) {
      closePlacesPanel(true);
    }
  };

  const handlePanelKeydown = (e: KeyboardEvent) => {
    if (!openPanel) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closePlacesPanel(true);
      return;
    }

    const items: HTMLButtonElement[] = [];
    const buttons = openPanel.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i += 1) {
      const btn = buttons[i];
      if (btn instanceof HTMLButtonElement && !btn.disabled) {
        items.push(btn);
      }
    }
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      let currentIndex = -1;
      if (doc.activeElement instanceof HTMLButtonElement) {
        currentIndex = items.indexOf(doc.activeElement);
      }
      const nextIndex = currentIndex < 0 || currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
      const target = items[nextIndex];
      if (target) {
        target.focus();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      let currentIndex = -1;
      if (doc.activeElement instanceof HTMLButtonElement) {
        currentIndex = items.indexOf(doc.activeElement);
      }
      const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      const target = items[prevIndex];
      if (target) {
        target.focus();
      }
      return;
    }

    if (e.key === 'Tab') {
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;

      const activeEl = doc.activeElement;
      if (e.shiftKey) {
        if (activeEl === firstItem || !openPanel.contains(activeEl)) {
          e.preventDefault();
          lastItem.focus();
        }
      } else {
        if (activeEl === lastItem || !openPanel.contains(activeEl)) {
          e.preventDefault();
          firstItem.focus();
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      const activeEl = doc.activeElement;
      if (activeEl instanceof HTMLButtonElement && items.includes(activeEl)) {
        activeEl.click();
        e.preventDefault();
      }
      return;
    }
  };

  const openPlacesPanel = () => {
    if (isPanelOpen) {
      closePlacesPanel(true);
      return;
    }
    if (!placesBtn || placesBtn.hidden) return;
    if (!currentScenes || currentScenes.length === 0) return;

    const places = groupScenesIntoPlaces(currentScenes, preferredLang);
    if (places.length === 0) return;

    isPanelOpen = true;
    placesBtn.setAttribute('aria-expanded', 'true');

    const panel = doc.createElement('div');
    panel.id = 'places-panel';
    panel.className = 'xplor-places-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    const titleText = labels.placesTitle ?? labels.places ?? 'Lieux';
    panel.setAttribute('aria-label', titleText);

    const documentDir = doc.documentElement.getAttribute('dir');
    if (documentDir) {
      panel.setAttribute('dir', documentDir);
    }

    const titleEl = doc.createElement('h2');
    titleEl.id = 'places-panel-title';
    titleEl.className = 'xplor-places-title';
    titleEl.textContent = titleText;
    panel.appendChild(titleEl);
    panel.setAttribute('aria-labelledby', 'places-panel-title');

    const listContainer = doc.createElement('div');
    listContainer.className = 'xplor-places-list';

    for (let i = 0; i < places.length; i += 1) {
      const place = places[i];
      if (!place) continue;

      const entryBtn = doc.createElement('button');
      entryBtn.type = 'button';
      entryBtn.className = 'xplor-place-item';

      if (currentSceneId !== null && place.sceneIds.includes(currentSceneId)) {
        entryBtn.setAttribute('aria-current', 'true');
      }

      const thumbImg = doc.createElement('img');
      thumbImg.className = 'xplor-place-thumb';
      thumbImg.src = place.thumb;
      thumbImg.alt = place.name;
      thumbImg.loading = 'lazy';
      entryBtn.appendChild(thumbImg);

      const infoDiv = doc.createElement('div');
      infoDiv.className = 'xplor-place-info';

      const nameSpan = doc.createElement('span');
      nameSpan.className = 'xplor-place-name';
      nameSpan.textContent = place.name;
      infoDiv.appendChild(nameSpan);

      const countSpan = doc.createElement('span');
      countSpan.className = 'xplor-place-count';
      countSpan.textContent = String(place.count);
      infoDiv.appendChild(countSpan);

      entryBtn.appendChild(infoDiv);

      entryBtn.addEventListener('click', () => {
        if (activeGoToScene) {
          activeGoToScene(place.firstSceneId);
        }
        closePlacesPanel(true);
      });

      listContainer.appendChild(entryBtn);
    }

    panel.appendChild(listContainer);
    doc.body.appendChild(panel);
    openPanel = panel;

    doc.addEventListener('keydown', handlePanelKeydown);
    doc.addEventListener('click', handleOutsideClick);

    // Focus initial : lieu courant ou première entrée
    const currentBtn = panel.querySelector('button[aria-current="true"]');
    if (currentBtn instanceof HTMLButtonElement) {
      currentBtn.focus();
    } else {
      const firstBtn = panel.querySelector('button');
      if (firstBtn instanceof HTMLButtonElement) {
        firstBtn.focus();
      }
    }
  };

  const createPlacesButton = (): HTMLButtonElement => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.classList.add('xplor-nav-btn--places');
    const labelText = labels.places ?? 'Lieux';
    btn.setAttribute('aria-label', labelText);
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'places-panel');
    btn.innerHTML = PLACES_ICON_SVG;
    btn.hidden = isVrActive;
    btn.addEventListener('click', () => {
      if (isPanelOpen) {
        closePlacesPanel(true);
      } else {
        openPlacesPanel();
      }
    });
    return btn;
  };

  if (currentScenes !== undefined) {
    placesBtn = createPlacesButton();
  }

  const ensurePlacesButton = () => {
    if (!placesBtn) {
      if (currentScenes !== undefined) {
        placesBtn = createPlacesButton();
        nav.insertBefore(placesBtn, prevBtn);
      }
    } else {
      placesBtn.hidden = isVrActive;
    }
  };

  const updatePlacesCurrent = () => {
    if (!openPanel || !currentScenes) return;
    const places = groupScenesIntoPlaces(currentScenes, preferredLang);
    const entryButtons: HTMLButtonElement[] = [];
    const buttons = openPanel.querySelectorAll('button.xplor-place-item');
    for (let i = 0; i < buttons.length; i += 1) {
      const b = buttons[i];
      if (b instanceof HTMLButtonElement) {
        entryButtons.push(b);
      }
    }

    for (let i = 0; i < entryButtons.length; i += 1) {
      const btn = entryButtons[i];
      const place = places[i];
      if (!btn || !place) continue;
      if (currentSceneId !== null && place.sceneIds.includes(currentSceneId)) {
        btn.setAttribute('aria-current', 'true');
      } else {
        btn.removeAttribute('aria-current');
      }
    }
  };

  nav.appendChild(backBtn);
  if (placesBtn) {
    nav.appendChild(placesBtn);
  }
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  nav.appendChild(infoBtn);
  nav.appendChild(fsBtn);
  if (gyroBtn) {
    nav.appendChild(gyroBtn);
  }

  doc.body.appendChild(nav);

  return {
    update(state: ControlsState) {
      prevBtn.disabled = state.previous === null;
      nextBtn.disabled = state.next === null;
      backBtn.hidden = !state.canGoBack;
      infoBtn.hidden = !state.hasPracticalInfo;

      if (typeof state.currentSceneId === 'string' || state.currentSceneId === null) {
        currentSceneId = state.currentSceneId;
      } else if (typeof state.sceneId === 'string' || state.sceneId === null) {
        currentSceneId = state.sceneId;
      } else if (typeof state.current === 'string' || state.current === null) {
        currentSceneId = state.current;
      }

      if (Array.isArray(state.scenes)) {
        currentScenes = state.scenes;
        ensurePlacesButton();
      }

      updatePlacesCurrent();
    },
    showGyroscope(visible: boolean) {
      if (gyroBtn) {
        gyroBtn.hidden = !visible;
      }
    },
    setVrActive(active: boolean) {
      isVrActive = active;
      const legalLink = doc.getElementById('legal-link');
      if (legalLink instanceof HTMLElement) {
        legalLink.hidden = active;
      }
      if (active) {
        closePlacesPanel(false);
        if (placesBtn) {
          placesBtn.hidden = true;
        }
      } else if (placesBtn) {
        placesBtn.hidden = false;
      }
    },
    destroy() {
      closePlacesPanel(false);
      nav.remove();
    }
  };
}
