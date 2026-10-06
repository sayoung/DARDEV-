import { describe, it, expect } from 'vitest';
import { createEditHistory, type EditCommand } from './editHistory';

describe('createEditHistory', () => {
  const moveCmd: EditCommand = {
    kind: 'move',
    hotspotId: 'h1',
    from: { yaw: 0, pitch: 0 },
    to: { yaw: 1, pitch: 1 },
  };

  const moveCmd2: EditCommand = {
    kind: 'move',
    hotspotId: 'h2',
    from: { yaw: 2, pitch: 2 },
    to: { yaw: 3, pitch: 3 },
  };

  it('push, undo et redo de base', () => {
    const history = createEditHistory();
    
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.push(moveCmd);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    const undone = history.undo();
    expect(undone).toEqual(moveCmd);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    const redone = history.redo();
    expect(redone).toEqual(moveCmd);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('vide le redo après un push', () => {
    const history = createEditHistory();
    
    history.push(moveCmd);
    history.undo();
    expect(history.canRedo()).toBe(true);

    history.push(moveCmd2);
    expect(history.canRedo()).toBe(false);
    
    const undone = history.undo();
    expect(undone).toEqual(moveCmd2);
    const emptyUndo = history.undo();
    expect(emptyUndo).toBeNull();
  });

  it('respecte la limite', () => {
    const history = createEditHistory(2);
    
    history.push({ ...moveCmd, hotspotId: 'h1' });
    history.push({ ...moveCmd, hotspotId: 'h2' });
    history.push({ ...moveCmd, hotspotId: 'h3' });

    const undo1 = history.undo();
    expect(undo1?.hotspotId).toBe('h3');
    
    const undo2 = history.undo();
    expect(undo2?.hotspotId).toBe('h2');
    
    const emptyUndo = history.undo();
    expect(emptyUndo).toBeNull();
  });

  it('undo/redo sur piles vides renvoient null', () => {
    const history = createEditHistory();
    const undone = history.undo();
    expect(undone).toBeNull();
    const redone = history.redo();
    expect(redone).toBeNull();
  });

  it('clear vide le past et le future', () => {
    const history = createEditHistory();
    history.push(moveCmd);
    history.undo();
    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});
