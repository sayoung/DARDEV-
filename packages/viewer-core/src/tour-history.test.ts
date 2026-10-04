import { describe, it, expect } from 'vitest';
import { createTourHistory, type HistoryEntry } from './tour-history.js';

describe('createTourHistory', () => {
  it('devrait s\'initialiser vide', () => {
    const history = createTourHistory();
    expect(history.size()).toBe(0);
    expect(history.canGoBack()).toBe(false);
    expect(history.peek()).toBeNull();
    expect(history.pop()).toBeNull();
  });

  it('devrait ajouter et retirer dans l\'ordre LIFO', () => {
    const history = createTourHistory();
    const entry1: HistoryEntry = { shareToken: 't1', sceneId: 's1', yaw: 0, pitch: 0 };
    const entry2: HistoryEntry = { shareToken: 't2', sceneId: 's2', yaw: 10, pitch: 10 };

    history.push(entry1);
    expect(history.size()).toBe(1);
    expect(history.canGoBack()).toBe(true);
    expect(history.peek()).toEqual(entry1);

    history.push(entry2);
    expect(history.size()).toBe(2);
    expect(history.peek()).toEqual(entry2);

    const popped1 = history.pop();
    expect(popped1).toEqual(entry2);
    expect(history.size()).toBe(1);
    expect(history.peek()).toEqual(entry1);

    const popped2 = history.pop();
    expect(popped2).toEqual(entry1);
    expect(history.size()).toBe(0);
    expect(history.canGoBack()).toBe(false);
  });

  it('devrait respecter la limite max et supprimer la plus ancienne', () => {
    const history = createTourHistory(3);
    const e1: HistoryEntry = { shareToken: 't', sceneId: '1', yaw: 0, pitch: 0 };
    const e2: HistoryEntry = { shareToken: 't', sceneId: '2', yaw: 0, pitch: 0 };
    const e3: HistoryEntry = { shareToken: 't', sceneId: '3', yaw: 0, pitch: 0 };
    const e4: HistoryEntry = { shareToken: 't', sceneId: '4', yaw: 0, pitch: 0 };

    history.push(e1);
    history.push(e2);
    history.push(e3);
    history.push(e4); // Dépasse la limite, e1 doit être supprimée

    expect(history.size()).toBe(3);
    const items = [];
    while (history.size() > 0) {
      items.push(history.pop());
    }
    expect(items).toEqual([e4, e3, e2]); // LIFO
  });

  it('devrait ignorer un doublon consécutif (même shareToken et sceneId)', () => {
    const history = createTourHistory();
    const e1: HistoryEntry = { shareToken: 't1', sceneId: 's1', yaw: 0, pitch: 0 };
    const e2: HistoryEntry = { shareToken: 't1', sceneId: 's1', yaw: 90, pitch: 45 }; // Même token/scene
    const e3: HistoryEntry = { shareToken: 't2', sceneId: 's1', yaw: 0, pitch: 0 }; // Token différent
    const e4: HistoryEntry = { shareToken: 't2', sceneId: 's2', yaw: 0, pitch: 0 }; // Scene différente

    history.push(e1);
    history.push(e2); // Ignoré

    expect(history.size()).toBe(1);
    expect(history.peek()).toEqual(e1);

    history.push(e3);
    expect(history.size()).toBe(2);

    history.push(e4);
    expect(history.size()).toBe(3);
  });

  it('devrait copier les entrées défensivement (pas de mutation par référence)', () => {
    const history = createTourHistory();
    const entry: HistoryEntry = { shareToken: 't1', sceneId: 's1', yaw: 0, pitch: 0 };
    
    history.push(entry);
    
    // Mutation externe
    entry.yaw = 90;
    
    const peeked = history.peek();
    expect(peeked).not.toBeNull();
    expect(peeked?.yaw).toBe(0); // Non muté
    expect(peeked).not.toBe(entry); // Référence différente

    // Vérifier aussi la copie au pop/peek
    if (peeked) {
      peeked.pitch = 45; // Tente de muter ce qui est retourné
    }

    const popped = history.pop();
    expect(popped).not.toBeNull();
    expect(popped?.pitch).toBe(0); // Non muté par le peek
  });

  it('devrait vider la pile avec clear()', () => {
    const history = createTourHistory();
    history.push({ shareToken: 't1', sceneId: 's1', yaw: 0, pitch: 0 });
    history.push({ shareToken: 't2', sceneId: 's2', yaw: 0, pitch: 0 });
    
    history.clear();
    expect(history.size()).toBe(0);
    expect(history.canGoBack()).toBe(false);
    expect(history.peek()).toBeNull();
  });
});
