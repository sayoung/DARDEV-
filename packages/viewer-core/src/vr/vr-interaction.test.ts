import { describe, it, expect, vi } from 'vitest';
import { createGazeSelector } from './gaze-selector.js';
import { createVrFade } from './vr-fade.js';
import { createVrInteraction } from './vr-interaction.js';
import { createVrInteraction as createVrInteractionFromIndex } from '../index.js';
import type { HotspotTarget } from './vr-geometry.js';

describe('vr-interaction (M6 F-71)', () => {
  it('est exporté depuis index.ts', () => {
    expect(createVrInteractionFromIndex).toBe(createVrInteraction);
  });

  describe('fixation 2 s déclenche une seule navigation au noir', () => {
    it('déclenche onNavigate exactement une fois au milieu du fondu (au noir)', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [{ id: 'hotspot-oudaias', yaw: 0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      // 1. Début de fixation (t = 0 ms)
      const frame0 = interaction.frame({ yaw: 0, pitch: 0 }, 0);
      expect(frame0.progress).toBe(0);
      expect(frame0.fadeOpacity).toBe(0);
      expect(frame0.hoveredId).toBe('hotspot-oudaias');
      expect(fade.isActive()).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();

      // 2. Fixation intermédiaire (t = 1000 ms -> 50% de dwell)
      const frame1000 = interaction.frame({ yaw: 0, pitch: 0 }, 1000);
      expect(frame1000.progress).toBeCloseTo(0.5);
      expect(frame1000.fadeOpacity).toBe(0);
      expect(frame1000.hoveredId).toBe('hotspot-oudaias');
      expect(fade.isActive()).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();

      // 3. 2 secondes de fixation continue atteintes (t = 2000 ms)
      // La sélection est émise par gaze, le fondu démarre
      const frame2000 = interaction.frame({ yaw: 0, pitch: 0 }, 2000);
      expect(frame2000.progress).toBe(1);
      expect(frame2000.fadeOpacity).toBe(0);
      expect(frame2000.hoveredId).toBe('hotspot-oudaias');
      expect(fade.isActive()).toBe(true);
      // Le fondu démarre à t=2000, le milieu est à 2150 ms : onNavigate n'a pas encore été appelé
      expect(onNavigate).not.toHaveBeenCalled();

      // 4. Montée progressive du noir (t = 2075 ms -> 50% du fondu vers le noir)
      const frame2075 = interaction.frame({ yaw: 0, pitch: 0 }, 2075);
      expect(frame2075.progress).toBe(1);
      expect(frame2075.fadeOpacity).toBeCloseTo(0.5);
      expect(frame2075.hoveredId).toBe('hotspot-oudaias');
      expect(onNavigate).not.toHaveBeenCalled();

      // 5. Au noir complet / milieu du fondu (t = 2150 ms -> 2000 + 300 / 2)
      // onNavigate est appelé au noir complet
      const frame2150 = interaction.frame({ yaw: 0, pitch: 0 }, 2150);
      expect(frame2150.progress).toBe(1);
      expect(frame2150.fadeOpacity).toBe(1);
      expect(frame2150.hoveredId).toBe('hotspot-oudaias');
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('hotspot-oudaias');

      // 6. Descente vers la fin du fondu (t = 2225 ms -> opacité 0.5)
      const frame2225 = interaction.frame({ yaw: 0, pitch: 0 }, 2225);
      expect(frame2225.fadeOpacity).toBeCloseTo(0.5);
      expect(onNavigate).toHaveBeenCalledTimes(1);

      // 7. Fin du fondu (t = 2300 ms -> opacité 0, actif = false)
      const frame2300 = interaction.frame({ yaw: 0, pitch: 0 }, 2300);
      expect(frame2300.fadeOpacity).toBe(0);
      expect(fade.isActive()).toBe(false);
      expect(onNavigate).toHaveBeenCalledTimes(1);

      // 8. Poursuite de la fixation sur la même cible sans la quitter (t = 2500, 3000 ms)
      // Aucun second appel de navigation
      interaction.frame({ yaw: 0, pitch: 0 }, 2500);
      interaction.frame({ yaw: 0, pitch: 0 }, 3000);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('fondu actif ignore une nouvelle sélection', () => {
    it('ignore un appel selectNow pendant un fondu actif déclenché par le regard', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [
        { id: 'spot-1', yaw: 0, pitch: 0 },
        { id: 'spot-2', yaw: 0.8, pitch: 0 },
      ];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      // Fixation de spot-1
      interaction.frame({ yaw: 0, pitch: 0 }, 0);
      interaction.frame({ yaw: 0, pitch: 0 }, 2000);
      expect(fade.isActive()).toBe(true);

      // Tentative de sélection concurrente par manette pendant le fondu
      interaction.selectNow('spot-2', 2050);

      // Avancement jusqu'au noir complet
      interaction.frame({ yaw: 0, pitch: 0 }, 2150);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('spot-1');

      // Fin du fondu
      interaction.frame({ yaw: 0, pitch: 0 }, 2300);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('ignore un appel selectNow pendant un fondu actif déclenché par selectNow', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [{ id: 'spot-1', yaw: 0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      // Sélection manette spot-1
      interaction.selectNow('spot-1', 1000);
      expect(fade.isActive()).toBe(true);

      // Tentative immédiate d'une autre sélection pendant que le fondu tourne
      interaction.selectNow('spot-2', 1050);

      // Frame au noir complet
      interaction.frame(null, 1150);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('spot-1');

      // Fin du fondu
      interaction.frame(null, 1300);
      expect(fade.isActive()).toBe(false);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('ignore une sélection par le regard survenue pendant un fondu actif', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 100 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [
        { id: 'spot-1', yaw: 0, pitch: 0 },
        { id: 'spot-2', yaw: 0.05, pitch: 0 },
      ];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      // Déclenchement d'un fondu sur spot-1 à t = 1000
      interaction.selectNow('spot-1', 1000);
      expect(fade.isActive()).toBe(true);

      // Regard sur spot-2 pendant le fondu avec dwell rapide (100 ms)
      interaction.frame({ yaw: 0.05, pitch: 0 }, 1010);
      // Dwell de spot-2 atteint à t = 1120 ms, mais le fondu de spot-1 est actif !
      interaction.frame({ yaw: 0.05, pitch: 0 }, 1120);

      // Milieu du fondu de spot-1 à 1150 ms
      interaction.frame({ yaw: 0.05, pitch: 0 }, 1150);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('spot-1');

      // Fin du fondu de spot-1 à 1300 ms
      interaction.frame({ yaw: 0.05, pitch: 0 }, 1300);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('selectNow', () => {
    it('déclenche le fondu et navigue au noir complet à la moitié de la durée', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [{ id: 'spot-controller', yaw: 0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      interaction.selectNow('spot-controller', 5000);
      expect(fade.isActive()).toBe(true);
      expect(onNavigate).not.toHaveBeenCalled();

      // Progression du fondu
      const midFrame = interaction.frame(null, 5150);
      expect(midFrame.fadeOpacity).toBe(1);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('spot-controller');

      // Terminaison du fondu
      const endFrame = interaction.frame(null, 5300);
      expect(endFrame.fadeOpacity).toBe(0);
      expect(fade.isActive()).toBe(false);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('ignore les identifiants invalides ou vides', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector();
      const fade = createVrFade();

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => [],
        onNavigate,
      });

      interaction.selectNow('', 1000);
      interaction.selectNow('   ', 1000);
      expect(fade.isActive()).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('ignore un horodatage non fini', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector();
      const fade = createVrFade();

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => [],
        onNavigate,
      });

      interaction.selectNow('spot-1', Number.NaN);
      expect(fade.isActive()).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('regard null', () => {
    it('renvoie hoveredId null et progression nulle lorsque gazeDir est null', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [{ id: 'spot-1', yaw: 0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      const res = interaction.frame(null, 1000);
      expect(res).toEqual({
        progress: 0,
        fadeOpacity: 0,
        hoveredId: null,
      });
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('réinitialise la progression de fixation si le regard passe à null', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [{ id: 'spot-1', yaw: 0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      // Fixation pendant 1000 ms (50%)
      interaction.frame({ yaw: 0, pitch: 0 }, 1000);
      const half = interaction.frame({ yaw: 0, pitch: 0 }, 2000);
      expect(half.progress).toBeCloseTo(0.5);

      // Perte de visée (gazeDir = null)
      const nullFrame = interaction.frame(null, 2500);
      expect(nullFrame.progress).toBe(0);
      expect(nullFrame.hoveredId).toBeNull();

      // Nouvelle visée à t=3000 ms : repart à zéro
      const restart = interaction.frame({ yaw: 0, pitch: 0 }, 3000);
      expect(restart.progress).toBe(0);
      expect(restart.hoveredId).toBe('spot-1');
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('laisse le fondu se dérouler normalement même si gazeDir est null', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => [{ id: 'spot-1', yaw: 0, pitch: 0 }],
        onNavigate,
      });

      interaction.selectNow('spot-1', 1000);
      expect(fade.isActive()).toBe(true);

      const midRes = interaction.frame(null, 1150);
      expect(midRes.fadeOpacity).toBe(1);
      expect(midRes.hoveredId).toBeNull();
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('spot-1');
    });
  });

  describe('sélection angulaire et gestion des cibles', () => {
    it('ignore les cibles situées hors du seuil angulaire (maxRad)', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [{ id: 'spot-far', yaw: 1.0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      // Visée à yaw=0 alors que la cible est à yaw=1.0 (hors seuil 0.12 rad)
      const res = interaction.frame({ yaw: 0, pitch: 0 }, 1000);
      expect(res.hoveredId).toBeNull();
      expect(res.progress).toBe(0);
    });

    it('sélectionne la cible la plus proche quand plusieurs sont dans le champ', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [
        { id: 'spot-medium', yaw: 0.08, pitch: 0 },
        { id: 'spot-closest', yaw: 0.02, pitch: 0 },
      ];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      const res = interaction.frame({ yaw: 0, pitch: 0 }, 1000);
      expect(res.hoveredId).toBe('spot-closest');
    });

    it('actualise dynamiquement la liste des cibles retournée par getTargets', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      let currentTargets: HotspotTarget[] = [{ id: 'scene-1-spot', yaw: 0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => currentTargets,
        onNavigate,
      });

      const res1 = interaction.frame({ yaw: 0, pitch: 0 }, 1000);
      expect(res1.hoveredId).toBe('scene-1-spot');

      // Changement de scène dynamique
      currentTargets = [{ id: 'scene-2-spot', yaw: 0, pitch: 0 }];

      const res2 = interaction.frame({ yaw: 0, pitch: 0 }, 1050);
      expect(res2.hoveredId).toBe('scene-2-spot');
    });

    it('traite les coordonnées non finies de gazeDir comme regard nul', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [{ id: 'spot-1', yaw: 0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      const res = interaction.frame({ yaw: Number.NaN, pitch: 0 }, 1000);
      expect(res.hoveredId).toBeNull();
      expect(res.progress).toBe(0);
    });

    it('réinitialise le regard et le fondu via reset()', () => {
      const onNavigate = vi.fn();
      const gaze = createGazeSelector({ dwellMs: 2000 });
      const fade = createVrFade({ durationMs: 300 });
      const targets: HotspotTarget[] = [{ id: 'spot-1', yaw: 0, pitch: 0 }];

      const interaction = createVrInteraction({
        gaze,
        fade,
        getTargets: () => targets,
        onNavigate,
      });

      interaction.frame({ yaw: 0, pitch: 0 }, 1000);
      interaction.frame({ yaw: 0, pitch: 0 }, 1500);
      interaction.selectNow('spot-1', 1500);
      expect(fade.isActive()).toBe(true);

      interaction.reset();
      expect(fade.isActive()).toBe(false);

      const afterReset = interaction.frame(null, 1600);
      expect(afterReset.progress).toBe(0);
      expect(afterReset.fadeOpacity).toBe(0);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });
});
