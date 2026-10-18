import { describe, it, expect, vi } from 'vitest';
import { createVrFade } from './vr-fade.js';
import { createVrFade as createVrFadeFromIndex } from '../index.js';

describe('vr-fade (M6 F-71)', () => {
  it('est exporté depuis index.ts', () => {
    expect(createVrFadeFromIndex).toBe(createVrFade);
  });

  describe('état initial', () => {
    it('est inactif par défaut', () => {
      const fade = createVrFade();
      expect(fade.isActive()).toBe(false);
    });

    it('renvoie une opacité nulle et active à false si update est appelé sans start', () => {
      const fade = createVrFade();
      const result = fade.update(1000);
      expect(result).toEqual({ opacity: 0, active: false });
    });
  });

  describe('démarrage et première moitié (montée vers le noir)', () => {
    it('devient actif dès start()', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);
      expect(fade.isActive()).toBe(true);
      expect(onMidpoint).not.toHaveBeenCalled();
    });

    it('démarre à opacité 0 à l instant initial', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);
      const res = fade.update(1000);

      expect(res).toEqual({ opacity: 0, active: true });
      expect(onMidpoint).not.toHaveBeenCalled();
    });

    it('monte linéairement de 0 à 1 pendant la première moitié', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);

      // Quart de la durée totale (50 % de la première moitié : 75 ms)
      const quarter = fade.update(1075);
      expect(quarter.active).toBe(true);
      expect(quarter.opacity).toBeCloseTo(0.5);
      expect(onMidpoint).not.toHaveBeenCalled();

      // Juste avant le milieu (140 ms sur 150 ms : ~93.3 %)
      const almostMid = fade.update(1140);
      expect(almostMid.active).toBe(true);
      expect(almostMid.opacity).toBeCloseTo(140 / 150);
      expect(onMidpoint).not.toHaveBeenCalled();
    });
  });

  describe('point médian (noir complet et appel onMidpoint)', () => {
    it('atteint l opacité 1 et appelle onMidpoint exactement une fois au milieu', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);

      const mid = fade.update(1150); // 1000 + 300 / 2
      expect(mid).toEqual({ opacity: 1, active: true });
      expect(onMidpoint).toHaveBeenCalledTimes(1);

      // Frame suivante : onMidpoint ne doit pas être réappelé
      const nextFrame = fade.update(1160);
      expect(nextFrame.active).toBe(true);
      expect(onMidpoint).toHaveBeenCalledTimes(1);
    });

    it('appelle onMidpoint si le temps saute directement au-delà du milieu', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);

      // Saut direct à 200 ms
      const res = fade.update(1200);
      expect(onMidpoint).toHaveBeenCalledTimes(1);
      expect(res.active).toBe(true);
    });
  });

  describe('seconde moitié (redescente vers la transparence)', () => {
    it('fait redescendre l opacité linéairement de 1 à 0', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);
      fade.update(1150); // passage du milieu

      // 225 ms : 50 % de la seconde moitié
      const threeQuarters = fade.update(1225);
      expect(threeQuarters.active).toBe(true);
      expect(threeQuarters.opacity).toBeCloseTo(0.5);

      // 270 ms : 80 % de la seconde moitié, reste 30 ms sur 150 ms => opacité 0.2
      const nearEnd = fade.update(1270);
      expect(nearEnd.active).toBe(true);
      expect(nearEnd.opacity).toBeCloseTo(0.2);
    });
  });

  describe('fin du fondu', () => {
    it('repasse l opacité à 0 et active à false à durationMs', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);
      fade.update(1150);

      const end = fade.update(1300);
      expect(end).toEqual({ opacity: 0, active: false });
      expect(fade.isActive()).toBe(false);
    });

    it('maintient l opacité à 0 et active à false pour les updates ultérieures', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);
      fade.update(1300);

      const afterEnd = fade.update(1500);
      expect(afterEnd).toEqual({ opacity: 0, active: false });
      expect(fade.isActive()).toBe(false);
      expect(onMidpoint).toHaveBeenCalledTimes(1);
    });

    it('appelle onMidpoint si l update saute directement au-delà de la fin', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);

      // Saut direct à 1500 ms (après la fin de 1300 ms)
      const res = fade.update(1500);
      expect(onMidpoint).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ opacity: 0, active: false });
      expect(fade.isActive()).toBe(false);
    });
  });

  describe('concurrence et start() pendant un fondu actif', () => {
    it('ignore tout start() appelé pendant un fondu actif', () => {
      const fade = createVrFade({ durationMs: 300 });
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      fade.start(1000, firstCallback);
      fade.update(1050);

      // Tentative de redémarrer un fondu à 1100 ms
      fade.start(1100, secondCallback);

      // Le milieu doit toujours être basé sur le start d origine (1000 + 150 = 1150)
      fade.update(1150);
      expect(firstCallback).toHaveBeenCalledTimes(1);
      expect(secondCallback).not.toHaveBeenCalled();

      // Fin du fondu original à 1300 ms
      const end = fade.update(1300);
      expect(end).toEqual({ opacity: 0, active: false });
      expect(secondCallback).not.toHaveBeenCalled();
    });

    it('permet de démarrer un nouveau fondu une fois le précédent terminé', () => {
      const fade = createVrFade({ durationMs: 300 });
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      fade.start(1000, firstCallback);
      fade.update(1300); // fin du 1er fondu

      // Démarrage du 2nd fondu
      fade.start(2000, secondCallback);
      expect(fade.isActive()).toBe(true);

      const mid2 = fade.update(2150);
      expect(mid2).toEqual({ opacity: 1, active: true });
      expect(secondCallback).toHaveBeenCalledTimes(1);

      const end2 = fade.update(2300);
      expect(end2).toEqual({ opacity: 0, active: false });
    });
  });

  describe('options de configuration', () => {
    it('utilise la durée durationMs spécifiée', () => {
      const fade = createVrFade({ durationMs: 600 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);

      // Milieu à 300 ms (1300 ms)
      fade.update(1290);
      expect(onMidpoint).not.toHaveBeenCalled();

      const mid = fade.update(1300);
      expect(mid).toEqual({ opacity: 1, active: true });
      expect(onMidpoint).toHaveBeenCalledTimes(1);

      // Fin à 600 ms (1600 ms)
      const end = fade.update(1600);
      expect(end).toEqual({ opacity: 0, active: false });
    });

    it('applique la durée par défaut de 300 ms si l option est absente ou invalide', () => {
      const fadeDefault = createVrFade();
      const cb1 = vi.fn();
      fadeDefault.start(0, cb1);
      expect(fadeDefault.update(150)).toEqual({ opacity: 1, active: true });
      expect(fadeDefault.update(300)).toEqual({ opacity: 0, active: false });

      const fadeNegative = createVrFade({ durationMs: -500 });
      const cb2 = vi.fn();
      fadeNegative.start(0, cb2);
      expect(fadeNegative.update(150)).toEqual({ opacity: 1, active: true });
      expect(fadeNegative.update(300)).toEqual({ opacity: 0, active: false });

      const fadeZero = createVrFade({ durationMs: 0 });
      const cb3 = vi.fn();
      fadeZero.start(0, cb3);
      expect(fadeZero.update(150)).toEqual({ opacity: 1, active: true });
      expect(fadeZero.update(300)).toEqual({ opacity: 0, active: false });
    });
  });

  describe('reset et cas limites temporels', () => {
    it('reset() interrompt immédiatement le fondu actif et annule l appel du callback', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);
      fade.update(1050);

      fade.reset();
      expect(fade.isActive()).toBe(false);
      expect(fade.update(1150)).toEqual({ opacity: 0, active: false });
      expect(onMidpoint).not.toHaveBeenCalled();
    });

    it('permet de redémarrer un fondu immédiatement après reset()', () => {
      const fade = createVrFade({ durationMs: 300 });
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      fade.start(1000, cb1);
      fade.reset();

      fade.start(2000, cb2);
      expect(fade.isActive()).toBe(true);
      fade.update(2150);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('ne produit pas d opacité négative si nowMs régresse', () => {
      const fade = createVrFade({ durationMs: 300 });
      const onMidpoint = vi.fn();

      fade.start(1000, onMidpoint);
      const regressed = fade.update(800);

      expect(regressed.opacity).toBe(0);
      expect(regressed.active).toBe(true);
      expect(onMidpoint).not.toHaveBeenCalled();
    });

    it('ignore start() si nowMs n est pas un nombre fini', () => {
      const fade = createVrFade();
      const onMidpoint = vi.fn();

      fade.start(Number.NaN, onMidpoint);
      expect(fade.isActive()).toBe(false);
      expect(fade.update(100)).toEqual({ opacity: 0, active: false });
      expect(onMidpoint).not.toHaveBeenCalled();
    });
  });
});
