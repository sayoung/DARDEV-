let activeCloseFn: (() => void) | null = null;

export function openMediaOverlay(
  doc: Document,
  content: { title: string; media: { url: string; mimeType: string }[] },
  labels: { close: string; previous: string; next: string }
): { close: () => void } {
  if (activeCloseFn) {
    activeCloseFn();
  }

  const validMedia = content.media.filter(
    (m) =>
      m.mimeType.startsWith('image/') ||
      m.mimeType.startsWith('video/') ||
      m.mimeType.startsWith('audio/')
  );

  if (validMedia.length === 0) {
    return { close: () => {} };
  }

  const existingOverlay = doc.getElementById('media-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = doc.createElement('div');
  overlay.id = 'media-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', content.title);

  const firstMedia = validMedia[0];

  if (firstMedia !== undefined) {
    if (firstMedia.mimeType.startsWith('image/')) {
      const img = doc.createElement('img');
      img.alt = content.title;
      img.src = firstMedia.url;
      overlay.appendChild(img);
    } else if (firstMedia.mimeType.startsWith('video/')) {
      const video = doc.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.src = firstMedia.url;
      overlay.appendChild(video);
    } else if (firstMedia.mimeType.startsWith('audio/')) {
      const audio = doc.createElement('audio');
      audio.controls = true;
      audio.src = firstMedia.url;
      overlay.appendChild(audio);
    }
  }

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = labels.close;
  closeButton.setAttribute('aria-label', labels.close);
  overlay.appendChild(closeButton);

  doc.body.appendChild(overlay);
  closeButton.focus();

  let isClosed = false;

  const closeFn = () => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    doc.removeEventListener('keydown', handleKeydown);

    const video = overlay.querySelector('video');
    if (video) {
      video.pause();
    }
    const audio = overlay.querySelector('audio');
    if (audio) {
      audio.pause();
    }

    const currentOverlay = doc.getElementById('media-overlay');
    if (currentOverlay) {
      currentOverlay.remove();
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
  closeButton.addEventListener('click', closeFn);

  activeCloseFn = closeFn;

  return { close: closeFn };
}
