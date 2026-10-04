let activeCloseFn: (() => void) | null = null;

export function openInfoPanel(
  doc: Document,
  content: { title: string; bodyHtml: string; images: string[] },
  labels: { close: string }
): { close: () => void } {
  if (activeCloseFn) {
    activeCloseFn();
  }

  const existingPanel = doc.getElementById('info-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  const aside = doc.createElement('aside');
  aside.id = 'info-panel';
  aside.setAttribute('role', 'dialog');
  aside.setAttribute('aria-modal', 'false');
  aside.setAttribute('aria-labelledby', 'info-panel-title');

  const h2 = doc.createElement('h2');
  h2.id = 'info-panel-title';
  h2.textContent = content.title;
  aside.appendChild(h2);

  const div = doc.createElement('div');
  div.innerHTML = content.bodyHtml;
  aside.appendChild(div);

  for (const src of content.images) {
    const img = doc.createElement('img');
    img.setAttribute('alt', '');
    img.setAttribute('loading', 'lazy');
    img.src = src;
    aside.appendChild(img);
  }

  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = labels.close;
  button.setAttribute('aria-label', labels.close);
  aside.appendChild(button);

  doc.body.appendChild(aside);
  button.focus();

  let isClosed = false;

  const closeFn = () => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    doc.removeEventListener('keydown', handleKeydown);
    const panel = doc.getElementById('info-panel');
    if (panel) {
      panel.remove();
    }
    if (activeCloseFn === closeFn) {
      activeCloseFn = null;
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeFn();
    }
  };

  doc.addEventListener('keydown', handleKeydown);
  button.addEventListener('click', closeFn);

  activeCloseFn = closeFn;

  return { close: closeFn };
}
