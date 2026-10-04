import { TourGraphScene } from '@xplor/shared';

export const AMBIENT_VOLUME = 0.25;

export interface AudioPlanResult {
  narration: {
    action: 'play' | 'stop' | 'none';
    url: string | null;
  };
  ambient: {
    action: 'start' | 'stop' | 'keep' | 'none';
    url: string | null;
    volume: number;
  };
}

export function audioPlan(
  prev: TourGraphScene | null,
  next: TourGraphScene
): AudioPlanResult {
  // Narration logic
  let narrationAction: 'play' | 'stop' | 'none' = 'none';
  let narrationUrl: string | null = null;

  if (next.narrationUrl !== null) {
    narrationAction = 'play';
    narrationUrl = next.narrationUrl;
  } else if (prev && prev.narrationUrl !== null) {
    narrationAction = 'stop';
  }

  // Ambient logic
  let ambientAction: 'start' | 'stop' | 'keep' | 'none' = 'none';
  let ambientUrl: string | null = null;

  if (next.ambientUrl !== null) {
    if (prev && prev.ambientUrl === next.ambientUrl) {
      ambientAction = 'keep';
      ambientUrl = next.ambientUrl;
    } else {
      ambientAction = 'start';
      ambientUrl = next.ambientUrl;
    }
  } else if (prev && prev.ambientUrl !== null) {
    ambientAction = 'stop';
  }

  return {
    narration: {
      action: narrationAction,
      url: narrationUrl,
    },
    ambient: {
      action: ambientAction,
      url: ambientUrl,
      volume: AMBIENT_VOLUME,
    },
  };
}
