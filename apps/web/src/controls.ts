export function createControls(
  doc: Document,
  labels: {
    nav?: string;
    previous: string;
    next: string;
    back: string;
    fullscreen: string;
    practicalInfo: string;
  },
  handlers: {
    onPrevious(): void;
    onNext(): void;
    onBack(): void;
    onFullscreen(): void;
    onPracticalInfo(): void;
  }
): {
  update(state: {
    previous: string | null;
    next: string | null;
    canGoBack: boolean;
    hasPracticalInfo: boolean;
  }): void;
  destroy(): void;
} {
  const nav = doc.createElement('nav');
  nav.id = 'controls';
  nav.setAttribute('aria-label', labels.nav ?? 'Controls');

  const createButton = (label: string, text: string, handler: () => void) => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.textContent = text;
    btn.addEventListener('click', handler);
    return btn;
  };

  const backBtn = createButton(labels.back, '↩', () => { handlers.onBack(); });
  const prevBtn = createButton(labels.previous, '❮', () => { handlers.onPrevious(); });
  const nextBtn = createButton(labels.next, '❯', () => { handlers.onNext(); });
  const infoBtn = createButton(labels.practicalInfo, 'ℹ', () => { handlers.onPracticalInfo(); });
  const fsBtn = createButton(labels.fullscreen, '⛶', () => { handlers.onFullscreen(); });

  nav.appendChild(backBtn);
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  nav.appendChild(infoBtn);
  nav.appendChild(fsBtn);

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
    destroy() {
      nav.remove();
    }
  };
}
