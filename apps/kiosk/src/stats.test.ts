import { EVENT_CHANNELS } from '@xplor/shared';
import type { StatsSession, StatsSessionOptions, StatsTracker } from '@xplor/viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { startKioskStats } from './stats.js';

function createSession() {
  const tracker = {
    startSession: vi.fn<StatsTracker['startSession']>(),
    endSession: vi.fn<StatsTracker['endSession']>(),
    tourOpen: vi.fn<StatsTracker['tourOpen']>(),
    sceneView: vi.fn<StatsTracker['sceneView']>(),
    hotspotClick: vi.fn<StatsTracker['hotspotClick']>(),
    audioPlay: vi.fn<StatsTracker['audioPlay']>(),
    vrEnter: vi.fn<StatsTracker['vrEnter']>(),
    vrExit: vi.fn<StatsTracker['vrExit']>(),
    qrShown: vi.fn<StatsTracker['qrShown']>(),
    langChange: vi.fn<StatsTracker['langChange']>(),
  };
  const flush = vi.fn<StatsSession['flush']>().mockResolvedValue(undefined);
  const destroy = vi.fn<StatsSession['destroy']>().mockResolvedValue(undefined);
  const sessionTracker: StatsTracker = {
    startSession: () => { tracker.startSession(); },
    endSession: () => { tracker.endSession(); },
    tourOpen: (tourId) => { tracker.tourOpen(tourId); },
    sceneView: (tourId, sceneId) => { tracker.sceneView(tourId, sceneId); },
    hotspotClick: (tourId, sceneId, hotspotId) => { tracker.hotspotClick(tourId, sceneId, hotspotId); },
    audioPlay: (tourId, sceneId) => { tracker.audioPlay(tourId, sceneId); },
    vrEnter: () => { tracker.vrEnter(); },
    vrExit: () => { tracker.vrExit(); },
    qrShown: (tourId) => { tracker.qrShown(tourId); },
    langChange: (lang) => { tracker.langChange(lang); },
  };
  return {
    tracker,
    session: { tracker: sessionTracker, flush, destroy },
    flush,
    destroy,
  };
}

describe('startKioskStats', () => {
  it('crée une session KIOSK et lit le jeton dynamiquement à chaque envoi', () => {
    const mock = createSession();
    const receivedOptions: StatsSessionOptions[] = [];
    const createSessionSpy = vi.fn((options: StatsSessionOptions) => {
      receivedOptions.push(options);
      return mock.session;
    });
    let token: string | null = 'token-1';
    startKioskStats({
      apiBase: '/api/v1', getToken: () => token, getLang: () => 'fr', createSession: createSessionSpy,
    });

    expect(createSessionSpy).toHaveBeenCalledOnce();
    const options = receivedOptions[0];
    if (!options) throw new Error('session options missing');
    expect(options.channel).toBe(EVENT_CHANNELS.KIOSK);
    expect(options.document).toBeNull();
    expect(options.getToken?.()).toBe('token-1');
    token = 'token-2';
    expect(options.getToken?.()).toBe('token-2');
  });

  it('relaye le cycle de session, les interactions, la langue et la fermeture', async () => {
    const mock = createSession();
    const stats = startKioskStats({
      apiBase: '/api/v1', getToken: () => null, getLang: () => 'fr', session: mock.session,
    });
    stats.startSession();
    stats.openTour('tour');
    stats.sceneView('tour', 'scene');
    stats.hotspotClick('tour', 'scene', 'hotspot');
    stats.audioPlay('tour', 'scene');
    stats.qrShown('tour');
    stats.langChange('ar');
    stats.endSession();
    await stats.flush();
    await stats.destroy();

    expect(mock.tracker.startSession).toHaveBeenCalledOnce();
    expect(mock.tracker.tourOpen).toHaveBeenCalledWith('tour');
    expect(mock.tracker.sceneView).toHaveBeenCalledWith('tour', 'scene');
    expect(mock.tracker.hotspotClick).toHaveBeenCalledWith('tour', 'scene', 'hotspot');
    expect(mock.tracker.audioPlay).toHaveBeenCalledWith('tour', 'scene');
    expect(mock.tracker.qrShown).toHaveBeenCalledWith('tour');
    expect(mock.tracker.langChange).toHaveBeenCalledWith('ar');
    expect(mock.tracker.endSession).toHaveBeenCalledOnce();
    expect(mock.flush).toHaveBeenCalledOnce();
    expect(mock.destroy).toHaveBeenCalledOnce();
  });

  it('absorbe les erreurs du traqueur et de la construction de session', async () => {
    const mock = createSession();
    mock.tracker.tourOpen.mockImplementation(() => { throw new Error('offline'); });
    const stats = startKioskStats({
      apiBase: '/api/v1', getToken: () => null, getLang: () => 'fr', session: mock.session,
    });
    expect(() => { stats.openTour('tour'); }).not.toThrow();

    const broken = startKioskStats({
      apiBase: '/api/v1', getToken: () => null, getLang: () => 'fr',
      createSession: () => { throw new Error('unsupported'); },
    });
    expect(() => { broken.startSession(); }).not.toThrow();
    await expect(broken.flush()).resolves.toBeUndefined();
    await expect(broken.destroy()).resolves.toBeUndefined();
  });
});
