import { describe, expect, it } from 'vitest';

import {
  EVENT_CHANNELS,
  EVENT_TYPES,
  EventChannelSchema,
  EventTypeSchema,
  eventSchema,
  eventsBatchSchema,
  type Event,
  type EventsBatch,
} from './events.js';

function makeValidEvent(): Event {
  return {
    sessionId: '01990000-0000-7000-8000-000000000001',
    type: EVENT_TYPES.SESSION_START,
    channel: EVENT_CHANNELS.KIOSK,
    tourId: '01990000-0000-7000-8000-000000000002',
    sceneId: '01990000-0000-7000-8000-000000000003',
    hotspotId: '01990000-0000-7000-8000-000000000004',
    lang: 'fr',
    durationMs: 1500,
    occurredAt: '2026-10-19T12:00:00.000Z',
  };
}

function makeEventBatch(count: number): Event[] {
  const events: Event[] = [];
  for (let i = 0; i < count; i += 1) {
    events.push(makeValidEvent());
  }
  return events;
}

describe('eventsBatchSchema', () => {
  it('accepte un lot valide d\'événements', () => {
    const validBatch: EventsBatch = {
      events: [
        makeValidEvent(),
        {
          sessionId: '01990000-0000-7000-8000-000000000005',
          type: EVENT_TYPES.SCENE_VIEW,
          channel: EVENT_CHANNELS.WEB,
          lang: 'ar',
          occurredAt: '2026-10-19T12:01:00.000Z',
        },
      ],
    };
    const parsed = eventsBatchSchema.parse(validBatch);
    expect(parsed.events.length).toBe(2);
    expect(parsed.events[0]?.type).toBe(EVENT_TYPES.SESSION_START);
    expect(parsed.events[1]?.type).toBe(EVENT_TYPES.SCENE_VIEW);
  });

  it('refuse un lot vide', () => {
    const result = eventsBatchSchema.safeParse({ events: [] });
    expect(result.success).toBe(false);
  });

  it('refuse un lot de 201 événements', () => {
    const result = eventsBatchSchema.safeParse({
      events: makeEventBatch(201),
    });
    expect(result.success).toBe(false);
  });

  it('accepte les bornes de taille de lot (1 et 200 événements)', () => {
    expect(eventsBatchSchema.safeParse({ events: makeEventBatch(1) }).success).toBe(true);
    expect(eventsBatchSchema.safeParse({ events: makeEventBatch(200) }).success).toBe(true);
  });
});

describe('eventSchema', () => {
  it('refuse un type inconnu', () => {
    const result = eventSchema.safeParse({
      sessionId: '01990000-0000-7000-8000-000000000001',
      type: 'TYPE_INCONNU',
      channel: EVENT_CHANNELS.KIOSK,
      lang: 'fr',
      occurredAt: '2026-10-19T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un durationMs négatif', () => {
    const result = eventSchema.safeParse({
      sessionId: '01990000-0000-7000-8000-000000000001',
      type: EVENT_TYPES.SCENE_VIEW,
      channel: EVENT_CHANNELS.KIOSK,
      lang: 'fr',
      durationMs: -1,
      occurredAt: '2026-10-19T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un durationMs non entier', () => {
    const result = eventSchema.safeParse({
      sessionId: '01990000-0000-7000-8000-000000000001',
      type: EVENT_TYPES.SCENE_VIEW,
      channel: EVENT_CHANNELS.KIOSK,
      lang: 'fr',
      durationMs: 12.34,
      occurredAt: '2026-10-19T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un canal inconnu', () => {
    const result = eventSchema.safeParse({
      sessionId: '01990000-0000-7000-8000-000000000001',
      type: EVENT_TYPES.SESSION_START,
      channel: 'CANAL_INCONNU',
      lang: 'fr',
      occurredAt: '2026-10-19T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un sessionId non UUID', () => {
    const result = eventSchema.safeParse({
      sessionId: 'not-a-uuid',
      type: EVENT_TYPES.SESSION_START,
      channel: EVENT_CHANNELS.KIOSK,
      lang: 'fr',
      occurredAt: '2026-10-19T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('refuse des tourId, sceneId ou hotspotId qui ne sont pas des UUID', () => {
    const base = {
      sessionId: '01990000-0000-7000-8000-000000000001',
      type: EVENT_TYPES.HOTSPOT_CLICK,
      channel: EVENT_CHANNELS.VR,
      lang: 'fr',
      occurredAt: '2026-10-19T12:00:00.000Z',
    };
    expect(eventSchema.safeParse({ ...base, tourId: 'invalid-uuid' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, sceneId: 'invalid-uuid' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, hotspotId: 'invalid-uuid' }).success).toBe(false);
  });

  it('refuse une date occurredAt non ISO', () => {
    const result = eventSchema.safeParse({
      sessionId: '01990000-0000-7000-8000-000000000001',
      type: EVENT_TYPES.SESSION_START,
      channel: EVENT_CHANNELS.KIOSK,
      lang: 'fr',
      occurredAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un code langue trop long (> 8 caractères) ou vide', () => {
    const base = {
      sessionId: '01990000-0000-7000-8000-000000000001',
      type: EVENT_TYPES.LANG_CHANGE,
      channel: EVENT_CHANNELS.KIOSK,
      occurredAt: '2026-10-19T12:00:00.000Z',
    };
    expect(eventSchema.safeParse({ ...base, lang: '123456789' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, lang: '' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, lang: 'fr-FR' }).success).toBe(true);
    expect(eventSchema.safeParse({ ...base, lang: '12345678' }).success).toBe(true);
  });

  it('accepte les champs facultatifs omis ou avec valeur null', () => {
    const minimal = {
      sessionId: '01990000-0000-7000-8000-000000000001',
      type: EVENT_TYPES.SESSION_START,
      channel: EVENT_CHANNELS.WEB,
      lang: 'fr',
      occurredAt: '2026-10-19T12:00:00.000Z',
    };
    expect(eventSchema.safeParse(minimal).success).toBe(true);

    const withNulls = {
      ...minimal,
      tourId: null,
      sceneId: null,
      hotspotId: null,
      durationMs: null,
    };
    expect(eventSchema.safeParse(withNulls).success).toBe(true);
  });

  it('valide l\'ensemble des types d\'événements et des canaux du cahier des charges', () => {
    const allTypes = Object.values(EVENT_TYPES);
    for (const type of allTypes) {
      expect(EventTypeSchema.safeParse(type).success).toBe(true);
    }
    const allChannels = Object.values(EVENT_CHANNELS);
    for (const channel of allChannels) {
      expect(EventChannelSchema.safeParse(channel).success).toBe(true);
    }
  });

  it('ne comporte aucun champ de donnée personnelle (NF-02)', () => {
    const shape = eventSchema.shape;
    const personalKeys = ['ip', 'ipAddress', 'userId', 'user_id', 'email', 'name', 'travelerName'];
    for (const key of personalKeys) {
      expect(key in shape).toBe(false);
    }
  });
});
