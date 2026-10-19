import { describe, expect, it, vi } from 'vitest';
import {
  createVrSession,
  type VrRendererLike,
  type VrRendererXrLike,
  type XrSessionLike,
  type XrSystemLike,
} from './vr-session.js';

class FakeXrSession implements XrSessionLike {
  private endListeners: (() => void)[] = [];
  public endCallCount = 0;
  public endFailureError: Error | null = null;

  addEventListener(_type: 'end', cb: () => void): void {
    this.endListeners.push(cb);
  }

  end(): Promise<void> {
    this.endCallCount += 1;
    if (this.endFailureError !== null) {
      return Promise.reject(this.endFailureError);
    }
    return Promise.resolve();
  }

  simulateEndEvent(): void {
    for (const listener of this.endListeners) {
      listener();
    }
  }

  getListenerCount(): number {
    return this.endListeners.length;
  }
}

class FakeVrRendererXr implements VrRendererXrLike {
  public enabled = false;
  public setSessionCallCount = 0;
  public lastSession: XrSessionLike | null = null;
  public failureError: Error | null = null;

  setSession(s: XrSessionLike): Promise<void> {
    this.setSessionCallCount += 1;
    this.lastSession = s;
    if (this.failureError !== null) {
      return Promise.reject(this.failureError);
    }
    return Promise.resolve();
  }
}

class FakeVrRenderer implements VrRendererLike {
  public xr = new FakeVrRendererXr();
  public currentAnimationLoop: ((time: number) => void) | null = null;
  public setAnimationLoopCalls: (((time: number) => void) | null)[] = [];

  setAnimationLoop(cb: ((time: number) => void) | null): void {
    this.currentAnimationLoop = cb;
    this.setAnimationLoopCalls.push(cb);
  }
}

class FakeXrSystem implements XrSystemLike {
  public sessionToReturn: FakeXrSession = new FakeXrSession();
  public requestSessionCallCount = 0;
  public lastMode: string | null = null;
  public lastInit: object | undefined = undefined;
  public failureError: Error | null = null;

  requestSession(
    mode: 'immersive-vr',
    init?: object,
  ): Promise<XrSessionLike> {
    this.requestSessionCallCount += 1;
    this.lastMode = mode;
    this.lastInit = init;
    if (this.failureError !== null) {
      return Promise.reject(this.failureError);
    }
    return Promise.resolve(this.sessionToReturn);
  }
}

describe('createVrSession (M6 F-70, F-72)', () => {
  it('enter : active le renderer XR, configure la session et démarre la boucle', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();
    const onEnd = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
      onEnd,
    });

    expect(vrSession.isActive()).toBe(false);
    expect(fakeRenderer.xr.enabled).toBe(false);

    await vrSession.enter();

    expect(vrSession.isActive()).toBe(true);
    expect(fakeRenderer.xr.enabled).toBe(true);
    expect(fakeXr.requestSessionCallCount).toBe(1);
    expect(fakeXr.lastMode).toBe('immersive-vr');
    expect(fakeRenderer.xr.setSessionCallCount).toBe(1);
    expect(fakeRenderer.xr.lastSession).toBe(fakeXr.sessionToReturn);
    expect(fakeRenderer.currentAnimationLoop).not.toBeNull();
    expect(fakeXr.sessionToReturn.getListenerCount()).toBe(1);

    const animationCallback = fakeRenderer.currentAnimationLoop;
    if (animationCallback !== null) {
      animationCallback(1234.5);
      expect(onFrame).toHaveBeenCalledWith(1234.5);
      expect(onFrame).toHaveBeenCalledTimes(1);
    }
  });

  it('double enter : appel séquentiel idempotent sans redemander de session', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    await vrSession.enter();
    expect(fakeXr.requestSessionCallCount).toBe(1);
    expect(vrSession.isActive()).toBe(true);

    // Second appel séquentiel
    await vrSession.enter();
    expect(fakeXr.requestSessionCallCount).toBe(1);
    expect(fakeRenderer.xr.setSessionCallCount).toBe(1);
    expect(vrSession.isActive()).toBe(true);
  });

  it('double enter : appels concurrents mutualisés via une unique demande de session', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    await Promise.all([vrSession.enter(), vrSession.enter()]);

    expect(fakeXr.requestSessionCallCount).toBe(1);
    expect(fakeRenderer.xr.setSessionCallCount).toBe(1);
    expect(vrSession.isActive()).toBe(true);
  });

  it('exit : appelle session.end(), arrête la boucle et désactive le renderer XR', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    await vrSession.enter();
    expect(vrSession.isActive()).toBe(true);

    await vrSession.exit();

    expect(fakeXr.sessionToReturn.endCallCount).toBe(1);
    expect(fakeRenderer.currentAnimationLoop).toBeNull();
    expect(fakeRenderer.xr.enabled).toBe(false);
    expect(vrSession.isActive()).toBe(false);

    // Idempotence : un second exit n'échoue pas et ne rappelle pas session.end()
    await vrSession.exit();
    expect(fakeXr.sessionToReturn.endCallCount).toBe(1);
    expect(vrSession.isActive()).toBe(false);
  });

  it("exit programmatique : n'appelle pas onEnd (réservé à l'événement end du casque)", async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();
    const onEnd = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
      onEnd,
    });

    await vrSession.enter();
    await vrSession.exit();

    expect(fakeXr.sessionToReturn.endCallCount).toBe(1);
    expect(vrSession.isActive()).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('fin par le casque : événement end arrête la boucle et appelle onEnd', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();
    const onEnd = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
      onEnd,
    });

    await vrSession.enter();
    expect(vrSession.isActive()).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();

    // Simulation de la sortie initiée par le casque
    fakeXr.sessionToReturn.simulateEndEvent();

    expect(fakeRenderer.currentAnimationLoop).toBeNull();
    expect(fakeRenderer.xr.enabled).toBe(false);
    expect(vrSession.isActive()).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);

    // Un événement end répété n'appelle pas onEnd une deuxième fois
    fakeXr.sessionToReturn.simulateEndEvent();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('fin par le casque : fonctionne sans erreur si onEnd est omis', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    await vrSession.enter();
    expect(() => {
      fakeXr.sessionToReturn.simulateEndEvent();
    }).not.toThrow();

    expect(vrSession.isActive()).toBe(false);
    expect(fakeRenderer.currentAnimationLoop).toBeNull();
  });

  it('échec de requestSession : rejette proprement sans laisser de boucle active', async () => {
    const fakeXr = new FakeXrSystem();
    fakeXr.failureError = new Error('WebXR session rejected by user');
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    await expect(vrSession.enter()).rejects.toThrow(
      'WebXR session rejected by user',
    );

    expect(vrSession.isActive()).toBe(false);
    expect(fakeRenderer.xr.enabled).toBe(false);
    expect(fakeRenderer.currentAnimationLoop).toBeNull();
    expect(fakeXr.sessionToReturn.endCallCount).toBe(0);
  });

  it('échec de renderer.xr.setSession : rejette proprement sans laisser de boucle active et ferme la session obtenue', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    fakeRenderer.xr.failureError = new Error('WebGL context lost during setSession');
    const onFrame = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    await expect(vrSession.enter()).rejects.toThrow(
      'WebGL context lost during setSession',
    );

    expect(vrSession.isActive()).toBe(false);
    expect(fakeRenderer.xr.enabled).toBe(false);
    expect(fakeRenderer.currentAnimationLoop).toBeNull();
    expect(fakeXr.sessionToReturn.endCallCount).toBe(1);
  });

  it("échec de renderer.xr.setSession : propage l'erreur d'origine même si session.end() échoue", async () => {
    const fakeXr = new FakeXrSystem();
    fakeXr.sessionToReturn.endFailureError = new Error('Failed to end session');
    const fakeRenderer = new FakeVrRenderer();
    fakeRenderer.xr.failureError = new Error('WebGL context lost during setSession');
    const onFrame = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    await expect(vrSession.enter()).rejects.toThrow(
      'WebGL context lost during setSession',
    );

    expect(vrSession.isActive()).toBe(false);
    expect(fakeRenderer.xr.enabled).toBe(false);
    expect(fakeRenderer.currentAnimationLoop).toBeNull();
    expect(fakeXr.sessionToReturn.endCallCount).toBe(1);
  });

  it('exit appelé pendant un enter en cours : annule l’entrée et ferme la session sans boucle active', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();

    let resolveSetSession: () => void = () => {};
    const setSessionCalled = new Promise<void>((resolveCalled) => {
      fakeRenderer.xr.setSession = (s: XrSessionLike): Promise<void> => {
        fakeRenderer.xr.setSessionCallCount += 1;
        fakeRenderer.xr.lastSession = s;
        resolveCalled();
        return new Promise<void>((resolve) => {
          resolveSetSession = resolve;
        });
      };
    });

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    const enterPromise = vrSession.enter();
    await setSessionCalled;

    const exitPromise = vrSession.exit();
    resolveSetSession();
    await Promise.all([enterPromise, exitPromise]);

    expect(vrSession.isActive()).toBe(false);
    expect(fakeRenderer.xr.enabled).toBe(false);
    expect(fakeRenderer.currentAnimationLoop).toBeNull();
    expect(fakeXr.sessionToReturn.endCallCount).toBe(1);
  });

  it('événement end survenu pendant un enter en cours : ne démarre pas la boucle et nettoie la session', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();
    const onEnd = vi.fn();

    let resolveSetSession: () => void = () => {};
    const setSessionCalled = new Promise<void>((resolveCalled) => {
      fakeRenderer.xr.setSession = (s: XrSessionLike): Promise<void> => {
        fakeRenderer.xr.setSessionCallCount += 1;
        fakeRenderer.xr.lastSession = s;
        resolveCalled();
        return new Promise<void>((resolve) => {
          resolveSetSession = resolve;
        });
      };
    });

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
      onEnd,
    });

    const enterPromise = vrSession.enter();
    await setSessionCalled;

    // Simuler l'événement end survenu pendant que setSession était en cours
    fakeXr.sessionToReturn.simulateEndEvent();

    resolveSetSession();
    await enterPromise;

    expect(vrSession.isActive()).toBe(false);
    expect(fakeRenderer.xr.enabled).toBe(false);
    expect(fakeRenderer.currentAnimationLoop).toBeNull();
    expect(fakeXr.sessionToReturn.endCallCount).toBe(1);
  });

  it('ré-entrée après exit : permet d’ouvrir une nouvelle session proprement', async () => {
    const fakeXr = new FakeXrSystem();
    const fakeRenderer = new FakeVrRenderer();
    const onFrame = vi.fn();

    const vrSession = createVrSession({
      xr: fakeXr,
      renderer: fakeRenderer,
      onFrame,
    });

    await vrSession.enter();
    expect(vrSession.isActive()).toBe(true);
    await vrSession.exit();
    expect(vrSession.isActive()).toBe(false);

    const secondSession = new FakeXrSession();
    fakeXr.sessionToReturn = secondSession;

    await vrSession.enter();
    expect(vrSession.isActive()).toBe(true);
    expect(fakeRenderer.xr.enabled).toBe(true);
    expect(fakeRenderer.currentAnimationLoop).not.toBeNull();
    expect(fakeXr.requestSessionCallCount).toBe(2);

    await vrSession.exit();
    expect(secondSession.endCallCount).toBe(1);
    expect(vrSession.isActive()).toBe(false);
  });
});
