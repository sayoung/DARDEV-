import { describe, expect, it } from 'vitest';

import { createIdleController } from './idle-controller.js';

class FakeTimers {
  time = 0;
  nextId = 0;
  readonly timers = new Map<number, { at: number; callback: () => void }>();

  readonly now = (): number => this.time;

  readonly setTimeout = (callback: () => void, delayMs: number): number => {
    const id = this.nextId++;
    this.timers.set(id, { at: this.time + delayMs, callback });
    return id;
  };

  readonly clearTimeout = (handle: unknown): void => {
    if (typeof handle === 'number') this.timers.delete(handle);
  };

  advanceBy(milliseconds: number): void {
    const target = this.time + milliseconds;
    for (;;) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort(([, left], [, right]) => left.at - right.at)[0];
      if (!next) break;

      const [id, timer] = next;
      this.timers.delete(id);
      this.time = timer.at;
      timer.callback();
    }
    this.time = target;
  }
}

function createController(
  timers: FakeTimers,
  onIdle: () => void = () => undefined,
  onWake: () => void = () => undefined,
) {
  return createIdleController({
    idleTimeoutSeconds: 10,
    now: timers.now,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    onIdle,
    onWake,
  });
}

describe('createIdleController', () => {
  it('passe à IDLE et appelle onIdle à expiration du délai', () => {
    const timers = new FakeTimers();
    let idleCalls = 0;
    const controller = createController(timers, () => idleCalls++);

    timers.advanceBy(9_999);
    expect(controller.getState()).toBe('ACTIVE');
    expect(idleCalls).toBe(0);

    timers.advanceBy(1);
    expect(controller.getState()).toBe('IDLE');
    expect(idleCalls).toBe(1);
  });

  it('relance le délai à chaque interaction pendant que le kiosque est actif', () => {
    const timers = new FakeTimers();
    let idleCalls = 0;
    const controller = createController(timers, () => idleCalls++);

    timers.advanceBy(8_000);
    controller.notifyInteraction();
    timers.advanceBy(9_999);
    expect(controller.getState()).toBe('ACTIVE');
    expect(idleCalls).toBe(0);

    timers.advanceBy(1);
    expect(controller.getState()).toBe('IDLE');
    expect(idleCalls).toBe(1);
  });

  it('réveille le kiosque à la première interaction après le mode veille', () => {
    const timers = new FakeTimers();
    let idleCalls = 0;
    let wakeCalls = 0;
    const controller = createController(timers, () => idleCalls++, () => wakeCalls++);
    timers.advanceBy(10_000);

    controller.notifyInteraction();

    expect(controller.getState()).toBe('ACTIVE');
    expect(idleCalls).toBe(1);
    expect(wakeCalls).toBe(1);

    timers.advanceBy(10_000);
    expect(idleCalls).toBe(2);
    expect(wakeCalls).toBe(1);
  });

  it('ne rappelle pas onIdle tant qu’aucune interaction ne réveille le kiosque', () => {
    const timers = new FakeTimers();
    let idleCalls = 0;
    const controller = createController(timers, () => idleCalls++);

    timers.advanceBy(30_000);

    expect(controller.getState()).toBe('IDLE');
    expect(idleCalls).toBe(1);
  });
});
