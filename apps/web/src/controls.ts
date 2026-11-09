export function createControls(
  doc: Document,
  labels: {
    nav?: string;
    previous: string;
    next: string;
    back: string;
    fullscreen: string;
    practicalInfo: string;
    gyroscope?: string;
  },
  handlers: {
    onPrevious(): void;
    onNext(): void;
    onBack(): void;
    onFullscreen(): void;
    onPracticalInfo(): void;
    onGyroscope?(): void;
  }
): {
  update(state: {
    previous: string | null;
    next: string | null;
    canGoBack: boolean;
    hasPracticalInfo: boolean;
  }): void;
  showGyroscope(visible: boolean): void;
  destroy(): void;
} {
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

  nav.appendChild(backBtn);
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  nav.appendChild(infoBtn);
  nav.appendChild(fsBtn);
  if (gyroBtn) {
    nav.appendChild(gyroBtn);
  }

  doc.body.appendChild(nav);

  return {
    update(state: {
      previous: string | null;
      next: string | null;
      canGoBack: boolean;
      hasPracticalInfo: boolean;
    }) {
      prevBtn.disabled = state.previous === null;
      nextBtn.disabled = state.next === null;
      backBtn.hidden = !state.canGoBack;
      infoBtn.hidden = !state.hasPracticalInfo;
    },
    showGyroscope(visible: boolean) {
      if (gyroBtn) {
        gyroBtn.hidden = !visible;
      }
    },
    destroy() {
      nav.remove();
    }
  };
}
