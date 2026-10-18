export type IdleControllerState = 'ACTIVE' | 'IDLE';

export interface IdleControllerOptions {
  idleTimeoutSeconds: number;
  now: () => number;
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  onIdle: () => void;
  onWake: () => void;
}

export interface IdleController {
  getState: () => IdleControllerState;
  notifyInteraction: () => void;
  setIdleTimeoutSeconds: (seconds: number) => void;
}

export function createIdleController({
  idleTimeoutSeconds,
  now,
  setTimeout,
  clearTimeout,
  onIdle,
  onWake,
}: IdleControllerOptions): IdleController {
  if (!Number.isFinite(idleTimeoutSeconds) || idleTimeoutSeconds <= 0) {
    throw new RangeError('idleTimeoutSeconds must be a positive finite number');
  }

  let timeoutMs = idleTimeoutSeconds * 1000;
  let state: IdleControllerState = 'ACTIVE';
  let timer: unknown;
  let deadline = now() + timeoutMs;
  let timerVersion = 0;

  const scheduleTimeout = (): void => {
    timerVersion += 1;
    const version = timerVersion;
    timer = setTimeout(() => {
      if (version !== timerVersion || state === 'IDLE') return;

      if (deadline - now() > 0) {
        scheduleTimeout();
        return;
      }

      state = 'IDLE';
      onIdle();
    }, Math.max(0, deadline - now()));
  };

  const notifyInteraction = (): void => {
    if (state === 'IDLE') {
      state = 'ACTIVE';
      onWake();
    } else {
      clearTimeout(timer);
    }

    deadline = now() + timeoutMs;
    scheduleTimeout();
  };

  const setIdleTimeoutSeconds = (seconds: number): void => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new RangeError('idleTimeoutSeconds must be a positive finite number');
    }

    timeoutMs = seconds * 1000;

    if (state === 'ACTIVE') {
      clearTimeout(timer);
      deadline = now() + timeoutMs;
      scheduleTimeout();
    }
  };

  scheduleTimeout();

  return {
    getState: () => state,
    notifyInteraction,
    setIdleTimeoutSeconds,
  };
}
