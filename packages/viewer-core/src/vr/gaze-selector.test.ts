import { describe, it, expect } from 'vitest';
import { createGazeSelector } from './gaze-selector.js';
import { createGazeSelector as createGazeSelectorFromIndex } from '../index.js';

describe('gaze-selector (M6 F-71)', () => {
  it('est exporté depuis index.ts', () => {
    expect(createGazeSelectorFromIndex).toBe(createGazeSelector);
  });

  describe('fixation courte', () => {
    it('renvoie un progrès nul au tout premier instant de fixation', () => {
      const selector = createGazeSelector();
      const result = selector.update('hotspot-1', 1000);

      expect(result).toEqual({ progress: 0, selectedId: null });
    });

    it('calcule la progression linéaire sans déclencher de sélection avant dwellMs', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      // Début de la fixation
      expect(selector.update('hotspot-1', 1000)).toEqual({ progress: 0, selectedId: null });

      // Après 500 ms (25 %)
      const quarter = selector.update('hotspot-1', 1500);
      expect(quarter.progress).toBeCloseTo(0.25);
      expect(quarter.selectedId).toBeNull();

      // Après 1000 ms (50 %)
      const half = selector.update('hotspot-1', 2000);
      expect(half.progress).toBeCloseTo(0.5);
      expect(half.selectedId).toBeNull();

      // Après 1900 ms (95 %)
      const almost = selector.update('hotspot-1', 2900);
      expect(almost.progress).toBeCloseTo(0.95);
      expect(almost.selectedId).toBeNull();
    });
  });

  describe('fixation complète', () => {
    it('sélectionne la cible quand 2000 ms de fixation continue sont atteintes', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      selector.update('hotspot-1', 2000);
      const result = selector.update('hotspot-1', 3000);

      expect(result).toEqual({ progress: 1, selectedId: 'hotspot-1' });
    });

    it('sélectionne la cible si le delta de temps dépasse directement dwellMs', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      const result = selector.update('hotspot-1', 3500);

      expect(result).toEqual({ progress: 1, selectedId: 'hotspot-1' });
    });
  });

  describe('changement de cible', () => {
    it('remet le progrès à zéro et annule la sélection lors du passage à une autre cible', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      selector.update('hotspot-1', 2000); // 50% sur hotspot-1

      // Changement immédiat vers hotspot-2
      const switchResult = selector.update('hotspot-2', 2500);
      expect(switchResult).toEqual({ progress: 0, selectedId: null });

      // Fixation de hotspot-2
      const halfB = selector.update('hotspot-2', 3500);
      expect(halfB.progress).toBeCloseTo(0.5);
      expect(halfB.selectedId).toBeNull();

      const doneB = selector.update('hotspot-2', 4500);
      expect(doneB).toEqual({ progress: 1, selectedId: 'hotspot-2' });
    });

    it('permet de sélectionner une nouvelle cible après avoir sélectionné une première cible', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      const doneA = selector.update('hotspot-1', 3000);
      expect(doneA).toEqual({ progress: 1, selectedId: 'hotspot-1' });

      // Regard porté vers une autre cible
      const startB = selector.update('hotspot-2', 3200);
      expect(startB).toEqual({ progress: 0, selectedId: null });

      const doneB = selector.update('hotspot-2', 5200);
      expect(doneB).toEqual({ progress: 1, selectedId: 'hotspot-2' });
    });
  });

  describe('null', () => {
    it('renvoie progress 0 et selectedId null quand la cible est null', () => {
      const selector = createGazeSelector();

      expect(selector.update(null, 1000)).toEqual({ progress: 0, selectedId: null });
      expect(selector.update(null, 2000)).toEqual({ progress: 0, selectedId: null });
    });

    it('interrompt une fixation en cours si la cible devient null', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      selector.update('hotspot-1', 2500); // 75%

      // Regard porté dans le vide
      expect(selector.update(null, 2600)).toEqual({ progress: 0, selectedId: null });

      // Retour sur la même cible : repart de zéro
      expect(selector.update('hotspot-1', 3000)).toEqual({ progress: 0, selectedId: null });

      const half = selector.update('hotspot-1', 4000);
      expect(half.progress).toBeCloseTo(0.5);
      expect(half.selectedId).toBeNull();

      const done = selector.update('hotspot-1', 5000);
      expect(done).toEqual({ progress: 1, selectedId: 'hotspot-1' });
    });

    it('quitter vers null après une sélection permet une ré-sélection ultérieure de la même cible', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      selector.update('hotspot-1', 3000); // Sélectionné

      // Quitte la cible vers null
      selector.update(null, 3200);

      // Re-fixe la même cible
      expect(selector.update('hotspot-1', 4000)).toEqual({ progress: 0, selectedId: null });
      expect(selector.update('hotspot-1', 6000)).toEqual({ progress: 1, selectedId: 'hotspot-1' });
    });
  });

  describe('pas de double sélection', () => {
    it('ne renvoie selectedId qu’une seule fois et maintient progress à 1 tant que la cible n’est pas quittée', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      const selected = selector.update('hotspot-1', 3000);
      expect(selected).toEqual({ progress: 1, selectedId: 'hotspot-1' });

      // Les frames suivantes continuent de fixer la même cible
      const frame1 = selector.update('hotspot-1', 3016);
      expect(frame1).toEqual({ progress: 1, selectedId: null });

      const frame2 = selector.update('hotspot-1', 3500);
      expect(frame2).toEqual({ progress: 1, selectedId: null });

      const frame3 = selector.update('hotspot-1', 5000);
      expect(frame3).toEqual({ progress: 1, selectedId: null });
    });
  });

  describe('reset', () => {
    it('réinitialise la progression pendant une fixation en cours', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      selector.update('hotspot-1', 2000); // 50%

      selector.reset();

      // Nouvelle mise à jour sur la même cible : repart de 0
      expect(selector.update('hotspot-1', 2500)).toEqual({ progress: 0, selectedId: null });
      expect(selector.update('hotspot-1', 3500).progress).toBeCloseTo(0.5);
      expect(selector.update('hotspot-1', 4500)).toEqual({ progress: 1, selectedId: 'hotspot-1' });
    });

    it('permet une nouvelle sélection sur la même cible sans devoir la quitter si reset() est appelé', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('hotspot-1', 1000);
      expect(selector.update('hotspot-1', 3000)).toEqual({ progress: 1, selectedId: 'hotspot-1' });

      // Toujours sur la même cible, on appelle reset() (ex: changement de scène ou confirmation)
      selector.reset();

      expect(selector.update('hotspot-1', 3100)).toEqual({ progress: 0, selectedId: null });
      expect(selector.update('hotspot-1', 5100)).toEqual({ progress: 1, selectedId: 'hotspot-1' });
    });
  });

  describe('options personnalisées et cas limites', () => {
    it('utilise la durée dwellMs personnalisée fournie en option', () => {
      const selector = createGazeSelector({ dwellMs: 800 });

      selector.update('marker-42', 100);
      const half = selector.update('marker-42', 500);
      expect(half.progress).toBeCloseTo(0.5);
      expect(half.selectedId).toBeNull();

      const done = selector.update('marker-42', 900);
      expect(done).toEqual({ progress: 1, selectedId: 'marker-42' });
    });

    it('applique le dwellMs par défaut de 2000 ms si l’option dwellMs est omise ou invalide', () => {
      const selectorDefault = createGazeSelector();
      selectorDefault.update('target', 0);
      expect(selectorDefault.update('target', 1000).progress).toBeCloseTo(0.5);
      expect(selectorDefault.update('target', 2000)).toEqual({ progress: 1, selectedId: 'target' });

      const selectorNegative = createGazeSelector({ dwellMs: -500 });
      selectorNegative.update('target', 0);
      expect(selectorNegative.update('target', 1000).progress).toBeCloseTo(0.5);
      expect(selectorNegative.update('target', 2000)).toEqual({ progress: 1, selectedId: 'target' });
    });

    it('ne produit pas de progrès négatif si nowMs régresse', () => {
      const selector = createGazeSelector({ dwellMs: 2000 });

      selector.update('target', 1000);
      const regressed = selector.update('target', 800);

      expect(regressed.progress).toBe(0);
      expect(regressed.selectedId).toBeNull();
    });
  });
});
