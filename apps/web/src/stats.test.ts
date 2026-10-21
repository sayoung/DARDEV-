import { describe, it, expect } from 'vitest';
import { EVENT_CHANNELS, type EventChannel } from '@xplor/shared';
import type { StatsSession, StatsSessionOptions, StatsTracker } from '@xplor/viewer-core';
import { startWebStats } from './stats.js';

interface TrackerCallLog {
  startSession: number;
  endSession: number;
  tourOpen: string[];
  sceneView: Array<{ tourId: string; sceneId: string }>;
  hotspotClick: Array<{ tourId: string; sceneId: string; hotspotId: string }>;
  audioPlay: Array<{ tourId: string; sceneId: string }>;
  vrEnter: number;
  vrExit: number;
  qrShown: Array<string | undefined>;
  langChange: string[];
}

function createStubTracker(): { tracker: StatsTracker; calls: TrackerCallLog } {
  const calls: TrackerCallLog = {
    startSession: 0,
    endSession: 0,
    tourOpen: [],
    sceneView: [],
    hotspotClick: [],
    audioPlay: [],
    vrEnter: 0,
    vrExit: 0,
    qrShown: [],
    langChange: [],
  };

  const tracker: StatsTracker = {
    startSession: () => {
      calls.startSession += 1;
    },
    endSession: () => {
      calls.endSession += 1;
    },
    tourOpen: (tourId: string) => {
      calls.tourOpen.push(tourId);
    },
    sceneView: (tourId: string, sceneId: string) => {
      calls.sceneView.push({ tourId, sceneId });
    },
    hotspotClick: (tourId: string, sceneId: string, hotspotId: string) => {
      calls.hotspotClick.push({ tourId, sceneId, hotspotId });
    },
    audioPlay: (tourId: string, sceneId: string) => {
      calls.audioPlay.push({ tourId, sceneId });
    },
    vrEnter: () => {
      calls.vrEnter += 1;
    },
    vrExit: () => {
      calls.vrExit += 1;
    },
    qrShown: (tourId?: string) => {
      calls.qrShown.push(tourId);
    },
    langChange: (lang: string) => {
      calls.langChange.push(lang);
    },
  };

  return { tracker, calls };
}

interface StubSession extends StatsSession {
  flushCalls: number;
  destroyCalls: number;
}

function createStubSession(tracker: StatsTracker): StubSession {
  const stub: StubSession = {
    tracker,
    flushCalls: 0,
    destroyCalls: 0,
    flush: () => {
      stub.flushCalls += 1;
      return Promise.resolve();
    },
    destroy: () => {
      stub.destroyCalls += 1;
      return Promise.resolve();
    },
  };
  return stub;
}

describe('startWebStats (M7 F-80)', () => {
  it('crée une session avec channel: "WEB", sans jeton et avec apiBase par défaut', () => {
    let capturedOptions: StatsSessionOptions | undefined;
    const { tracker } = createStubTracker();

    const mockCreateSession = (opts: StatsSessionOptions): StatsSession => {
      capturedOptions = opts;
      return createStubSession(tracker);
    };

    const stats = startWebStats({
      getLang: () => 'fr',
      createSession: mockCreateSession,
    });

    expect(stats).toBeDefined();
    expect(capturedOptions).toBeDefined();
    if (capturedOptions !== undefined) {
      expect(capturedOptions.channel).toBe(EVENT_CHANNELS.WEB);
      expect(capturedOptions.channel).toBe('WEB');
      expect(capturedOptions.getToken).toBeUndefined();
      expect(capturedOptions.apiBase).toBe('/api/v1');
      expect(capturedOptions.getLang()).toBe('fr');
    }
  });

  it('transmet un apiBase personnalisé', () => {
    let capturedOptions: StatsSessionOptions | undefined;
    const { tracker } = createStubTracker();

    startWebStats({
      apiBase: 'https://api.xplor.ma/api/v1',
      getLang: () => 'ar',
      createSession: (opts) => {
        capturedOptions = opts;
        return createStubSession(tracker);
      },
    });

    expect(capturedOptions).toBeDefined();
    if (capturedOptions !== undefined) {
      expect(capturedOptions.apiBase).toBe('https://api.xplor.ma/api/v1');
      expect(capturedOptions.channel).toBe('WEB');
      expect(capturedOptions.getLang()).toBe('ar');
    }
  });

  it('maintient le canal "WEB" même si l’URL contient src=kiosk', () => {
    let capturedChannel: EventChannel | undefined;
    const { tracker } = createStubTracker();

    // Simulation de navigation issue d'un kiosque via QR code : ?src=kiosk
    const dummyUrl = 'https://v.xplor.ma/v/abc1234?src=kiosk&lang=fr';
    const params = new URL(dummyUrl).searchParams;
    expect(params.get('src')).toBe('kiosk');

    startWebStats({
      apiBase: '/api/v1',
      getLang: () => 'fr',
      createSession: (opts) => {
        capturedChannel = opts.channel;
        return createStubSession(tracker);
      },
    });

    // La session doit rester 'WEB', aucune donnée personnelle
    expect(capturedChannel).toBe(EVENT_CHANNELS.WEB);
    expect(capturedChannel).toBe('WEB');
  });

  it('ouverture de visite : openTour déclenche startSession puis tourOpen', () => {
    const { tracker, calls } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    const TOUR_ID = '01990000-0000-7000-8000-000000000001';
    stats.openTour(TOUR_ID);

    expect(calls.startSession).toBe(1);
    expect(calls.tourOpen).toEqual([TOUR_ID]);
    expect(calls.qrShown).toEqual([]);
  });

  it('ouverture de visite : tourOpen déclenche également startSession puis tourOpen', () => {
    const { tracker, calls } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    const TOUR_ID = '01990000-0000-7000-8000-000000000001';
    stats.tourOpen(TOUR_ID);

    expect(calls.startSession).toBe(1);
    expect(calls.tourOpen).toEqual([TOUR_ID]);
    expect(calls.qrShown).toEqual([]);
  });

  it('changement de scène : déclenche sceneView avec tourId et sceneId', () => {
    const { tracker, calls } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    const TOUR_ID = '01990000-0000-7000-8000-000000000001';
    const SCENE_ID = '01990000-0000-7000-8000-000000000002';
    stats.sceneView(TOUR_ID, SCENE_ID);

    expect(calls.sceneView).toEqual([{ tourId: TOUR_ID, sceneId: SCENE_ID }]);
    expect(calls.startSession).toBe(0);
  });

  it('clic sur hotspot : déclenche hotspotClick avec tourId, sceneId et hotspotId', () => {
    const { tracker, calls } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    const TOUR_ID = '01990000-0000-7000-8000-000000000001';
    const SCENE_ID = '01990000-0000-7000-8000-000000000002';
    const HOTSPOT_ID = '01990000-0000-7000-8000-000000000003';
    stats.hotspotClick(TOUR_ID, SCENE_ID, HOTSPOT_ID);

    expect(calls.hotspotClick).toEqual([
      { tourId: TOUR_ID, sceneId: SCENE_ID, hotspotId: HOTSPOT_ID },
    ]);
  });

  it('lecture audio : déclenche audioPlay avec tourId et sceneId', () => {
    const { tracker, calls } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    const TOUR_ID = '01990000-0000-7000-8000-000000000001';
    const SCENE_ID = '01990000-0000-7000-8000-000000000002';
    stats.audioPlay(TOUR_ID, SCENE_ID);

    expect(calls.audioPlay).toEqual([{ tourId: TOUR_ID, sceneId: SCENE_ID }]);
  });

  it('changement de langue : déclenche langChange avec la nouvelle langue', () => {
    const { tracker, calls } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    stats.langChange('ar');
    expect(calls.langChange).toEqual(['ar']);

    stats.langChange('en');
    expect(calls.langChange).toEqual(['ar', 'en']);
  });

  it('qrShown enregistre les visites web provenant du QR kiosk', () => {
    const { tracker, calls } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    stats.openTour('01990000-0000-7000-8000-000000000001');
    stats.sceneView('01990000-0000-7000-8000-000000000001', '01990000-0000-7000-8000-000000000002');
    stats.hotspotClick('01990000-0000-7000-8000-000000000001', '01990000-0000-7000-8000-000000000002', '01990000-0000-7000-8000-000000000003');
    stats.audioPlay('01990000-0000-7000-8000-000000000001', '01990000-0000-7000-8000-000000000002');
    stats.qrShown?.('01990000-0000-7000-8000-000000000001');
    stats.langChange('en');

    expect(calls.qrShown).toEqual(['01990000-0000-7000-8000-000000000001']);
  });

  it('les alias onTourOpen, onSceneChange, onHotspotClick, onAudioPlay, onLangChange fonctionnent identiquement', () => {
    const { tracker, calls } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    stats.onTourOpen('t1');
    stats.onSceneChange('t1', 's1');
    stats.onHotspotClick('t1', 's1', 'h1');
    stats.onAudioPlay('t1', 's1');
    stats.onLangChange('ar');

    expect(calls.startSession).toBe(1);
    expect(calls.tourOpen).toEqual(['t1']);
    expect(calls.sceneView).toEqual([{ tourId: 't1', sceneId: 's1' }]);
    expect(calls.hotspotClick).toEqual([{ tourId: 't1', sceneId: 's1', hotspotId: 'h1' }]);
    expect(calls.audioPlay).toEqual([{ tourId: 't1', sceneId: 's1' }]);
    expect(calls.langChange).toEqual(['ar']);
  });

  it('flush et destroy délèguent à la session sous-jacente', async () => {
    const { tracker } = createStubTracker();
    const stubSession = createStubSession(tracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    expect(stubSession.flushCalls).toBe(0);
    expect(stubSession.destroyCalls).toBe(0);

    await stats.flush();
    expect(stubSession.flushCalls).toBe(1);

    await stats.destroy();
    expect(stubSession.destroyCalls).toBe(1);
  });

  it('résilience : n’échoue jamais si le traqueur lève une exception inattendue', () => {
    const throwingTracker: StatsTracker = {
      startSession: () => {
        throw new Error('Tracker crash startSession');
      },
      endSession: () => {
        throw new Error('Tracker crash endSession');
      },
      tourOpen: () => {
        throw new Error('Tracker crash tourOpen');
      },
      sceneView: () => {
        throw new Error('Tracker crash sceneView');
      },
      hotspotClick: () => {
        throw new Error('Tracker crash hotspotClick');
      },
      audioPlay: () => {
        throw new Error('Tracker crash audioPlay');
      },
      vrEnter: () => {},
      vrExit: () => {},
      qrShown: () => {},
      langChange: () => {
        throw new Error('Tracker crash langChange');
      },
    };

    const stubSession = createStubSession(throwingTracker);
    const stats = startWebStats({
      getLang: () => 'fr',
      session: stubSession,
    });

    expect(() => {
      stats.openTour('t-1');
    }).not.toThrow();
    expect(() => {
      stats.tourOpen('t-1');
    }).not.toThrow();
    expect(() => {
      stats.sceneView('t-1', 's-1');
    }).not.toThrow();
    expect(() => {
      stats.hotspotClick('t-1', 's-1', 'h-1');
    }).not.toThrow();
    expect(() => {
      stats.audioPlay('t-1', 's-1');
    }).not.toThrow();
    expect(() => {
      stats.langChange('en');
    }).not.toThrow();
  });

  it('résilience : n’échoue jamais si session.flush ou session.destroy rejette', async () => {
    const { tracker } = createStubTracker();
    const failingSession: StatsSession = {
      tracker,
      flush: () => Promise.reject(new Error('Network offline or 500 API')),
      destroy: () => Promise.reject(new Error('IndexedDB storage corrupt')),
    };

    const stats = startWebStats({
      getLang: () => 'fr',
      session: failingSession,
    });

    await expect(stats.flush()).resolves.toBeUndefined();
    await expect(stats.destroy()).resolves.toBeUndefined();
  });
});
