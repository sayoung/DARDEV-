import { TourGraphScene } from '@xplor/shared';
import { audioPlan } from '@xplor/viewer-core';

export function createSceneAudioPlayer(
  doc: Document,
  labels: { play: string; pause: string },
  factory?: (url: string) => HTMLAudioElement
) {
  const defaultFactory = (url: string) => new Audio(url);
  const createAudio = factory || defaultFactory;

  let ambientAudio: HTMLAudioElement | null = null;
  let narrationAudio: HTMLAudioElement | null = null;
  let isPlayingNarration = false;

  const btn = doc.createElement('button');
  btn.id = 'scene-audio-btn';
  btn.className = 'scene-audio-btn';
  btn.type = 'button';
  btn.hidden = true;
  btn.setAttribute('aria-label', labels.play);
  btn.textContent = '▶';
  doc.body.appendChild(btn);

  btn.addEventListener('click', () => {
    if (!narrationAudio) return;
    if (isPlayingNarration) {
      narrationAudio.pause();
      isPlayingNarration = false;
      btn.setAttribute('aria-label', labels.play);
      btn.textContent = '▶';
    } else {
      narrationAudio.play().catch(() => {});
      isPlayingNarration = true;
      btn.setAttribute('aria-label', labels.pause);
      btn.textContent = '⏸';
    }
  });

  function apply(prev: TourGraphScene | null, next: TourGraphScene): void {
    const plan = audioPlan(prev, next);

    // Ambient
    if (plan.ambient.action === 'start') {
      if (ambientAudio) {
        ambientAudio.pause();
        ambientAudio.src = '';
      }
      if (plan.ambient.url) {
        ambientAudio = createAudio(plan.ambient.url);
        ambientAudio.loop = true;
        ambientAudio.volume = plan.ambient.volume;
        ambientAudio.play().catch(() => {});
      }
    } else if (plan.ambient.action === 'stop') {
      if (ambientAudio) {
        ambientAudio.pause();
        ambientAudio.src = '';
        ambientAudio = null;
      }
    }

    // Narration
    if (narrationAudio) {
      narrationAudio.pause();
      narrationAudio.src = '';
      narrationAudio = null;
    }
    isPlayingNarration = false;
    btn.setAttribute('aria-label', labels.play);
    btn.textContent = '▶';
    btn.hidden = true;

    if (plan.narration.action === 'play' && plan.narration.url) {
      narrationAudio = createAudio(plan.narration.url);
      
      narrationAudio.addEventListener('ended', () => {
        isPlayingNarration = false;
        btn.setAttribute('aria-label', labels.play);
        btn.textContent = '▶';
      });

      btn.hidden = false;
    }
  }

  function destroy(): void {
    if (ambientAudio) {
      ambientAudio.pause();
      ambientAudio.src = '';
      ambientAudio = null;
    }
    if (narrationAudio) {
      narrationAudio.pause();
      narrationAudio.src = '';
      narrationAudio = null;
    }
    if (btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
  }

  return { apply, destroy };
}
