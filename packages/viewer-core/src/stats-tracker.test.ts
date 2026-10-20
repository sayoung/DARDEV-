import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EVENT_CHANNELS,
  EVENT_TYPES,
  eventSchema,
  type Event,
} from '@xplor/shared';
import {
  createStatsTracker,
  type StatsTracker,
  type StatsTrackerOptions,
} from './stats-tracker.js';

describe('createStatsTracker (M7 F-80)', () => {
  let uuidSequence = 1;
  let currentTime = 1_771_000_000_000;
  let currentLang = 'fr';
  let pushedEvents: Event[] = [];
  let pushMock = vi.fn<(event: Event) => void>();

  function generateValidUuid(): string {
    const hex = (uuidSequence++).toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  }

  function advanceTime(ms: number): void {
    currentTime += ms;
  }

  const TOUR_ID_A = '11111111-1111-4111-8111-111111111111';
  const TOUR_ID_B = '11111111-1111-4111-8111-222222222222';
  const SCENE_ID_A = '22222222-2222-4222-8222-111111111111';
  const SCENE_ID_B = '22222222-2222-4222-8222-222222222222';
  const HOTSPOT_ID_A = '33333333-3333-4333-8333-111111111111';

  function setupTracker(overrides?: Partial<StatsTrackerOptions>): StatsTracker {
    return createStatsTracker({
      batcher: { push: pushMock },
      channel: EVENT_CHANNELS.WEB,
      getLang: () => currentLang,
      now: () => currentTime,
      uuid: generateValidUuid,
      ...overrides,
    });
  }

  beforeEach(() => {
    uuidSequence = 1;
    currentTime = 1_771_000_000_000;
    currentLang = 'fr';
    pushedEvents = [];
    pushMock = vi.fn<(event: Event) => void>((event: Event) => {
      pushedEvents.push(event);
    });
  });

  describe('(1) durée de scène', () => {
    it('émet SCENE_VIEW avec durationMs 5000 pour A et rien pour B lors du passage à B', () => {
      const tracker = setupTracker();

      tracker.sceneView(TOUR_ID_A, SCENE_ID_A);
      expect(pushMock).not.toHaveBeenCalled();
      expect(pushedEvents).toHaveLength(0);

      advanceTime(5000);

      tracker.sceneView(TOUR_ID_A, SCENE_ID_B);

      expect(pushMock).toHaveBeenCalledTimes(1);
      expect(pushedEvents).toHaveLength(1);

      const eventA = pushedEvents[0];
      expect(eventA).toBeDefined();
      if (eventA !== undefined) {
        expect(eventA.type).toBe(EVENT_TYPES.SCENE_VIEW);
        expect(eventA.tourId).toBe(TOUR_ID_A);
        expect(eventA.sceneId).toBe(SCENE_ID_A);
        expect(eventA.durationMs).toBe(5000);
      }
    });

    it('ferme la scène B lors du passage à une troisième scène avec sa propre durée', () => {
      const tracker = setupTracker();

      tracker.sceneView(TOUR_ID_A, SCENE_ID_A);
      advanceTime(5000);
      tracker.sceneView(TOUR_ID_A, SCENE_ID_B);
      advanceTime(3200);

      const sceneC = generateValidUuid();
      tracker.sceneView(TOUR_ID_A, sceneC);

      expect(pushMock).toHaveBeenCalledTimes(2);
      expect(pushedEvents).toHaveLength(2);

      const eventB = pushedEvents[1];
      expect(eventB).toBeDefined();
      if (eventB !== undefined) {
        expect(eventB.type).toBe(EVENT_TYPES.SCENE_VIEW);
        expect(eventB.tourId).toBe(TOUR_ID_A);
        expect(eventB.sceneId).toBe(SCENE_ID_B);
        expect(eventB.durationMs).toBe(3200);
      }
    });
  });

  describe('(2) fin de session', () => {
    it('ferme la scène courante (SCENE_VIEW avec durationMs) puis émet SESSION_END avec durationMs depuis le début', () => {
      const tracker = setupTracker();

      tracker.startSession();
      expect(pushMock).toHaveBeenCalledTimes(1);

      advanceTime(2000);
      tracker.sceneView(TOUR_ID_A, SCENE_ID_A);
      expect(pushMock).toHaveBeenCalledTimes(1);

      advanceTime(4000);
      tracker.endSession();

      expect(pushMock).toHaveBeenCalledTimes(3);
      expect(pushedEvents).toHaveLength(3);

      const startEvt = pushedEvents[0];
      expect(startEvt).toBeDefined();
      if (startEvt !== undefined) {
        expect(startEvt.type).toBe(EVENT_TYPES.SESSION_START);
      }

      const sceneEvt = pushedEvents[1];
      expect(sceneEvt).toBeDefined();
      if (sceneEvt !== undefined) {
        expect(sceneEvt.type).toBe(EVENT_TYPES.SCENE_VIEW);
        expect(sceneEvt.tourId).toBe(TOUR_ID_A);
        expect(sceneEvt.sceneId).toBe(SCENE_ID_A);
        expect(sceneEvt.durationMs).toBe(4000);
      }

      const endEvt = pushedEvents[2];
      expect(endEvt).toBeDefined();
      if (endEvt !== undefined) {
        expect(endEvt.type).toBe(EVENT_TYPES.SESSION_END);
        expect(endEvt.durationMs).toBe(6000);
      }
    });

    it('émet SESSION_END avec durationMs correcte même si aucune scène n était ouverte', () => {
      const tracker = setupTracker();

      tracker.startSession();
      advanceTime(7500);
      tracker.endSession();

      expect(pushMock).toHaveBeenCalledTimes(2);
      expect(pushedEvents).toHaveLength(2);

      const endEvt = pushedEvents[1];
      expect(endEvt).toBeDefined();
      if (endEvt !== undefined) {
        expect(endEvt.type).toBe(EVENT_TYPES.SESSION_END);
        expect(endEvt.durationMs).toBe(7500);
      }
    });

    it('émet SESSION_END avec durationMs à null si startSession n a jamais été appelé', () => {
      const tracker = setupTracker();

      tracker.endSession();

      expect(pushMock).toHaveBeenCalledTimes(1);
      const endEvt = pushedEvents[0];
      expect(endEvt).toBeDefined();
      if (endEvt !== undefined) {
        expect(endEvt.type).toBe(EVENT_TYPES.SESSION_END);
        expect(endEvt.durationMs).toBeNull();
      }
    });
  });

  describe('(3) renouvellement du sessionId', () => {
    it('renouvelle le sessionId à chaque startSession avec des ids différents et SESSION_START porte le nouvel id', () => {
      const tracker = setupTracker();

      tracker.startSession();
      expect(pushMock).toHaveBeenCalledTimes(1);
      const evt1 = pushedEvents[0];
      expect(evt1).toBeDefined();

      tracker.startSession();
      expect(pushMock).toHaveBeenCalledTimes(2);
      const evt2 = pushedEvents[1];
      expect(evt2).toBeDefined();

      if (evt1 !== undefined && evt2 !== undefined) {
        expect(evt1.type).toBe(EVENT_TYPES.SESSION_START);
        expect(evt2.type).toBe(EVENT_TYPES.SESSION_START);
        expect(evt1.sessionId).not.toBe(evt2.sessionId);
        expect(eventSchema.shape.sessionId.safeParse(evt1.sessionId).success).toBe(true);
        expect(eventSchema.shape.sessionId.safeParse(evt2.sessionId).success).toBe(true);
      }
    });

    it('ferme la scène en cours avant de renouveler le sessionId pour la nouvelle session', () => {
      const tracker = setupTracker();

      tracker.startSession();
      const session1Id = pushedEvents[0]?.sessionId;

      tracker.sceneView(TOUR_ID_A, SCENE_ID_A);
      advanceTime(3000);

      tracker.startSession();

      expect(pushMock).toHaveBeenCalledTimes(3);
      const closedSceneEvt = pushedEvents[1];
      const newSessionStartEvt = pushedEvents[2];

      expect(closedSceneEvt).toBeDefined();
      expect(newSessionStartEvt).toBeDefined();

      if (closedSceneEvt !== undefined && newSessionStartEvt !== undefined) {
        expect(closedSceneEvt.type).toBe(EVENT_TYPES.SCENE_VIEW);
        expect(closedSceneEvt.sessionId).toBe(session1Id);
        expect(closedSceneEvt.durationMs).toBe(3000);

        expect(newSessionStartEvt.type).toBe(EVENT_TYPES.SESSION_START);
        expect(newSessionStartEvt.sessionId).not.toBe(session1Id);
      }
    });
  });

  describe('(4) gestion de la langue', () => {
    it('résout la langue via getLang() dynamiquement à chaque événement', () => {
      const tracker = setupTracker();

      currentLang = 'fr';
      tracker.tourOpen(TOUR_ID_A);

      currentLang = 'ar';
      tracker.vrEnter();

      currentLang = 'en';
      tracker.vrExit();

      expect(pushMock).toHaveBeenCalledTimes(3);

      const evtFr = pushedEvents[0];
      const evtAr = pushedEvents[1];
      const evtEn = pushedEvents[2];

      expect(evtFr).toBeDefined();
      expect(evtAr).toBeDefined();
      expect(evtEn).toBeDefined();

      if (evtFr !== undefined && evtAr !== undefined && evtEn !== undefined) {
        expect(evtFr.lang).toBe('fr');
        expect(evtAr.lang).toBe('ar');
        expect(evtEn.lang).toBe('en');
      }
    });

    it('utilise la langue explicite fournie pour langChange indépendamment de getLang()', () => {
      currentLang = 'fr';
      const tracker = setupTracker();

      tracker.langChange('ar');

      expect(pushMock).toHaveBeenCalledTimes(1);
      const evt = pushedEvents[0];
      expect(evt).toBeDefined();
      if (evt !== undefined) {
        expect(evt.type).toBe(EVENT_TYPES.LANG_CHANGE);
        expect(evt.lang).toBe('ar');
      }
    });
  });

  describe('(5) résilience et événements invalides', () => {
    it('n appelle pas batcher.push et ne lève aucune exception si getLang() renvoie une chaîne vide', () => {
      currentLang = '';
      const tracker = setupTracker();

      expect(() => {
        tracker.tourOpen(TOUR_ID_A);
      }).not.toThrow();

      expect(pushMock).not.toHaveBeenCalled();
      expect(pushedEvents).toHaveLength(0);
    });

    it('n appelle pas batcher.push et ne lève aucune exception si tourId n est pas un UUID valide', () => {
      const tracker = setupTracker();

      expect(() => {
        tracker.tourOpen('non-uuid-tour-id');
      }).not.toThrow();

      expect(pushMock).not.toHaveBeenCalled();
      expect(pushedEvents).toHaveLength(0);
    });

    it('ignore la scène si les identifiants ne sont pas des UUID valides', () => {
      const tracker = setupTracker();

      expect(() => {
        tracker.sceneView('invalid-tour', 'invalid-scene');
      }).not.toThrow();

      advanceTime(3000);

      expect(() => {
        tracker.sceneView(TOUR_ID_A, SCENE_ID_A);
      }).not.toThrow();

      expect(pushMock).not.toHaveBeenCalled();
    });

    it('ignore le clic hotspot si hotspotId n est pas un UUID valide', () => {
      const tracker = setupTracker();

      expect(() => {
        tracker.hotspotClick(TOUR_ID_A, SCENE_ID_A, 'not-a-uuid');
      }).not.toThrow();

      expect(pushMock).not.toHaveBeenCalled();
    });

    it('ne lève aucune exception si getLang() lève une erreur', () => {
      const tracker = setupTracker({
        getLang: () => {
          throw new Error('Erreur interne i18n');
        },
      });

      expect(() => {
        tracker.tourOpen(TOUR_ID_A);
      }).not.toThrow();

      expect(pushMock).not.toHaveBeenCalled();
    });

    it('ne lève aucune exception si batcher.push lève une erreur', () => {
      pushMock.mockImplementation(() => {
        throw new Error('Store plein');
      });

      const tracker = setupTracker();

      expect(() => {
        tracker.tourOpen(TOUR_ID_A);
      }).not.toThrow();
    });

    it('ne lève aucune exception si uuid() lève une erreur', () => {
      const tracker = setupTracker({
        uuid: () => {
          throw new Error('Générateur UUID défaillant');
        },
      });

      expect(() => {
        tracker.startSession();
      }).not.toThrow();
    });
  });

  describe('(6) présence de occurredAt ISO et channel', () => {
    it('inclut un horodatage ISO 8601 conforme et le canal WEB configuré', () => {
      const tracker = setupTracker({ channel: EVENT_CHANNELS.WEB });

      tracker.tourOpen(TOUR_ID_A);

      expect(pushMock).toHaveBeenCalledTimes(1);
      const evt = pushedEvents[0];
      expect(evt).toBeDefined();

      if (evt !== undefined) {
        expect(evt.channel).toBe(EVENT_CHANNELS.WEB);
        expect(evt.occurredAt).toBe(new Date(currentTime).toISOString());
        const validation = eventSchema.safeParse(evt);
        expect(validation.success).toBe(true);
      }
    });

    it('transmet fidèlement le canal KIOSK ou VR selon les options', () => {
      const kioskTracker = setupTracker({ channel: EVENT_CHANNELS.KIOSK });
      kioskTracker.tourOpen(TOUR_ID_A);

      const vrTracker = setupTracker({ channel: EVENT_CHANNELS.VR });
      vrTracker.tourOpen(TOUR_ID_B);

      expect(pushMock).toHaveBeenCalledTimes(2);
      const kioskEvt = pushedEvents[0];
      const vrEvt = pushedEvents[1];

      expect(kioskEvt).toBeDefined();
      expect(vrEvt).toBeDefined();

      if (kioskEvt !== undefined && vrEvt !== undefined) {
        expect(kioskEvt.channel).toBe(EVENT_CHANNELS.KIOSK);
        expect(vrEvt.channel).toBe(EVENT_CHANNELS.VR);
      }
    });
  });

  describe('Autres interactions (hotspotClick, audioPlay, qrShown)', () => {
    it('émet HOTSPOT_CLICK avec tourId, sceneId et hotspotId', () => {
      const tracker = setupTracker();

      tracker.hotspotClick(TOUR_ID_A, SCENE_ID_A, HOTSPOT_ID_A);

      expect(pushMock).toHaveBeenCalledTimes(1);
      const evt = pushedEvents[0];
      expect(evt).toBeDefined();
      if (evt !== undefined) {
        expect(evt.type).toBe(EVENT_TYPES.HOTSPOT_CLICK);
        expect(evt.tourId).toBe(TOUR_ID_A);
        expect(evt.sceneId).toBe(SCENE_ID_A);
        expect(evt.hotspotId).toBe(HOTSPOT_ID_A);
      }
    });

    it('émet AUDIO_PLAY avec tourId et sceneId', () => {
      const tracker = setupTracker();

      tracker.audioPlay(TOUR_ID_A, SCENE_ID_A);

      expect(pushMock).toHaveBeenCalledTimes(1);
      const evt = pushedEvents[0];
      expect(evt).toBeDefined();
      if (evt !== undefined) {
        expect(evt.type).toBe(EVENT_TYPES.AUDIO_PLAY);
        expect(evt.tourId).toBe(TOUR_ID_A);
        expect(evt.sceneId).toBe(SCENE_ID_A);
      }
    });

    it('émet QR_SHOWN avec ou sans tourId', () => {
      const tracker = setupTracker();

      tracker.qrShown(TOUR_ID_A);
      tracker.qrShown();

      expect(pushMock).toHaveBeenCalledTimes(2);

      const evtWithTour = pushedEvents[0];
      const evtWithoutTour = pushedEvents[1];

      expect(evtWithTour).toBeDefined();
      expect(evtWithoutTour).toBeDefined();

      if (evtWithTour !== undefined && evtWithoutTour !== undefined) {
        expect(evtWithTour.type).toBe(EVENT_TYPES.QR_SHOWN);
        expect(evtWithTour.tourId).toBe(TOUR_ID_A);

        expect(evtWithoutTour.type).toBe(EVENT_TYPES.QR_SHOWN);
        expect(evtWithoutTour.tourId).toBeUndefined();
      }
    });

    it('fonctionne avec les fonctions now et uuid par défaut si elles ne sont pas fournies', () => {
      const tracker = createStatsTracker({
        batcher: { push: pushMock },
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
      });

      tracker.tourOpen(TOUR_ID_A);

      expect(pushMock).toHaveBeenCalledTimes(1);
      const evt = pushedEvents[0];
      expect(evt).toBeDefined();
      if (evt !== undefined) {
        expect(evt.type).toBe(EVENT_TYPES.TOUR_OPEN);
        expect(eventSchema.safeParse(evt).success).toBe(true);
      }
    });
  });
});
