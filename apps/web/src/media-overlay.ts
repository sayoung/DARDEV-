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

  let currentIndex = 0;
  let currentMediaElement: HTMLElement | null = null;
  let prevButton: HTMLButtonElement | null = null;
  let nextButton: HTMLButtonElement | null = null;

  const renderMedia = () => {
    if (currentMediaElement) {
      if (currentMediaElement instanceof HTMLVideoElement || currentMediaElement instanceof HTMLAudioElement) {
        currentMediaElement.pause();
      }
      currentMediaElement.remove();
      currentMediaElement = null;
    }

    const mediaItem = validMedia[currentIndex];
    if (mediaItem) {
      if (mediaItem.mimeType.startsWith('image/')) {
        const img = doc.createElement('img');
        img.alt = content.title;
        img.src = mediaItem.url;
        currentMediaElement = img;
      } else if (mediaItem.mimeType.startsWith('video/')) {
        const video = doc.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.src = mediaItem.url;
        currentMediaElement = video;
      } else if (mediaItem.mimeType.startsWith('audio/')) {
        const audio = doc.createElement('audio');
        audio.controls = true;
        audio.src = mediaItem.url;
        currentMediaElement = audio;
      }

      if (currentMediaElement) {
        overlay.insertBefore(currentMediaElement, overlay.firstChild);
      }
    }

    if (prevButton) {
      prevButton.disabled = currentIndex === 0;
    }
    if (nextButton) {
      nextButton.disabled = currentIndex === validMedia.length - 1;
    }
  };

  if (validMedia.length > 1) {
    prevButton = doc.createElement('button');
    prevButton.type = 'button';
    prevButton.textContent = labels.previous;
    prevButton.setAttribute('aria-label', labels.previous);
    prevButton.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex--;
        renderMedia();
      }
    });

    nextButton = doc.createElement('button');
    nextButton.type = 'button';
    nextButton.textContent = labels.next;
    nextButton.setAttribute('aria-label', labels.next);
    nextButton.addEventListener('click', () => {
      if (currentIndex < validMedia.length - 1) {
        currentIndex++;
        renderMedia();
      }
    });

    overlay.appendChild(prevButton);
    overlay.appendChild(nextButton);
  }

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = labels.close;
  closeButton.setAttribute('aria-label', labels.close);
  overlay.appendChild(closeButton);

  renderMedia();

  doc.body.appendChild(overlay);
  closeButton.focus();

  let isClosed = false;

  const closeFn = () => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    doc.removeEventListener('keydown', handleKeydown);

    if (currentMediaElement) {
      if (currentMediaElement instanceof HTMLVideoElement || currentMediaElement instanceof HTMLAudioElement) {
        currentMediaElement.pause();
      }
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
