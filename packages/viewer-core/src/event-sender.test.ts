import { describe, it, expect, vi } from 'vitest';
import {
  EVENT_CHANNELS,
  EVENT_TYPES,
  eventsBatchSchema,
  type Event,
} from '@xplor/shared';
import {
  createEventSender,
  MAX_EVENT_BATCH_SIZE,
} from './event-sender.js';
import { createEventBatcher } from './event-batcher.js';

function createValidTestEvent(index = 1): Event {
  const hex = index.toString(16).padStart(12, '0');
  const event: Event = {
    sessionId: `01990000-0000-7000-8000-${hex}`,
    type: EVENT_TYPES.SCENE_VIEW,
    channel: EVENT_CHANNELS.WEB,
    tourId: '01990000-0000-7000-8000-000000000001',
    sceneId: '01990000-0000-7000-8000-000000000002',
    hotspotId: null,
    lang: 'fr',
    durationMs: 1200,
    occurredAt: '2026-10-20T12:00:00.000Z',
  };
  return event;
}

describe('createEventSender (M7 F-80)', () => {
  it('exposes MAX_EVENT_BATCH_SIZE equal to 200', () => {
    expect(MAX_EVENT_BATCH_SIZE).toBe(200);
  });

  it('does nothing when events array is empty', async () => {
    const mockFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ ingested: 0 }), { status: 200, statusText: 'OK' })),
    );

    const sender = createEventSender({
      apiBase: 'https://api.xplor.test',
      fetchFn: mockFetch,
    });

    await sender([]);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends POST request to {apiBase}/events with formatted body matching eventsBatchSchema', async () => {
    const mockFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ ingested: 2 }), { status: 200, statusText: 'OK' })),
    );

    const sender = createEventSender({
      apiBase: 'https://api.xplor.test',
      fetchFn: mockFetch,
    });

    const event1 = createValidTestEvent(1);
    const event2 = createValidTestEvent(2);

    await sender([event1, event2]);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall === undefined) {
      throw new Error('Expected firstCall to be recorded');
    }

    const [url, init] = firstCall;
    expect(url).toBe('https://api.xplor.test/events');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
    });

    const bodyRaw = init?.body;
    expect(typeof bodyRaw).toBe('string');
    if (typeof bodyRaw !== 'string') {
      throw new Error('Expected body to be a string');
    }

    const parsedJson: unknown = JSON.parse(bodyRaw);
    const batchValidation = eventsBatchSchema.safeParse(parsedJson);
    expect(batchValidation.success).toBe(true);
    if (!batchValidation.success) {
      throw new Error('Batch validation failed against eventsBatchSchema');
    }

    expect(batchValidation.data.events).toHaveLength(2);
    expect(batchValidation.data.events[0]?.sessionId).toBe(event1.sessionId);
    expect(batchValidation.data.events[1]?.sessionId).toBe(event2.sessionId);
  });

  it('normalizes trailing slash in apiBase', async () => {
    const mockFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), { status: 200, statusText: 'OK' })),
    );

    const sender = createEventSender({
      apiBase: 'https://api.xplor.test/',
      fetchFn: mockFetch,
    });

    await sender([createValidTestEvent(1)]);

    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall === undefined) {
      throw new Error('Expected firstCall to be recorded');
    }

    const [url] = firstCall;
    expect(url).toBe('https://api.xplor.test/events');
  });

  describe('headers and credentials', () => {
    it('sends headers without Authorization when getToken is undefined', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), { status: 200, statusText: 'OK' })),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      await sender([createValidTestEvent(1)]);

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall === undefined) {
        throw new Error('Expected firstCall to be recorded');
      }

      const [, init] = firstCall;
      expect(init?.headers).toEqual({
        'Content-Type': 'application/json',
      });
      expect(init?.credentials).toBe('omit');
    });

    it('sends headers without Authorization when getToken returns null', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), { status: 200, statusText: 'OK' })),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        getToken: () => null,
        fetchFn: mockFetch,
      });

      await sender([createValidTestEvent(1)]);

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall === undefined) {
        throw new Error('Expected firstCall to be recorded');
      }

      const [, init] = firstCall;
      expect(init?.headers).toEqual({
        'Content-Type': 'application/json',
      });
      expect(init?.credentials).toBe('omit');
    });

    it('sends headers without Authorization when getToken returns empty string or whitespace', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), { status: 200, statusText: 'OK' })),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        getToken: () => '   ',
        fetchFn: mockFetch,
      });

      await sender([createValidTestEvent(1)]);

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall === undefined) {
        throw new Error('Expected firstCall to be recorded');
      }

      const [, init] = firstCall;
      expect(init?.headers).toEqual({
        'Content-Type': 'application/json',
      });
      expect(init?.credentials).toBe('omit');
    });

    it('sends Authorization: Bearer <jeton> when getToken returns a valid token', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), { status: 200, statusText: 'OK' })),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        getToken: () => 'kiosk-token-secret-xyz',
        fetchFn: mockFetch,
      });

      await sender([createValidTestEvent(1)]);

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall === undefined) {
        throw new Error('Expected firstCall to be recorded');
      }

      const [, init] = firstCall;
      expect(init?.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer kiosk-token-secret-xyz',
      });
      expect(init?.credentials).toBe('omit');
    });
  });

  describe('batch slicing at 201 events', () => {
    it('splits 201 events into a batch of 200 followed by a batch of 1', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 200 }), { status: 200, statusText: 'OK' })),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        getToken: () => 'token-kiosk-test',
        fetchFn: mockFetch,
      });

      const events: Event[] = [];
      for (let i = 1; i <= 201; i += 1) {
        events.push(createValidTestEvent(i));
      }

      await sender(events);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Première tranche : 200 événements
      const call0 = mockFetch.mock.calls[0];
      expect(call0).toBeDefined();
      if (call0 === undefined) {
        throw new Error('Expected call0');
      }
      const [url0, init0] = call0;
      expect(url0).toBe('https://api.xplor.test/events');
      expect(init0?.method).toBe('POST');
      expect(init0?.credentials).toBe('omit');

      const body0Raw = init0?.body;
      expect(typeof body0Raw).toBe('string');
      if (typeof body0Raw !== 'string') {
        throw new Error('Expected body0Raw to be string');
      }
      const parsed0: unknown = JSON.parse(body0Raw);
      const batch0 = eventsBatchSchema.safeParse(parsed0);
      expect(batch0.success).toBe(true);
      if (!batch0.success) {
        throw new Error('Batch 0 validation failed');
      }
      expect(batch0.data.events).toHaveLength(200);
      expect(batch0.data.events[0]?.sessionId).toBe(events[0]?.sessionId);
      expect(batch0.data.events[199]?.sessionId).toBe(events[199]?.sessionId);

      // Seconde tranche : 1 événement restant
      const call1 = mockFetch.mock.calls[1];
      expect(call1).toBeDefined();
      if (call1 === undefined) {
        throw new Error('Expected call1');
      }
      const [url1, init1] = call1;
      expect(url1).toBe('https://api.xplor.test/events');
      expect(init1?.method).toBe('POST');
      expect(init1?.credentials).toBe('omit');

      const body1Raw = init1?.body;
      expect(typeof body1Raw).toBe('string');
      if (typeof body1Raw !== 'string') {
        throw new Error('Expected body1Raw to be string');
      }
      const parsed1: unknown = JSON.parse(body1Raw);
      const batch1 = eventsBatchSchema.safeParse(parsed1);
      expect(batch1.success).toBe(true);
      if (!batch1.success) {
        throw new Error('Batch 1 validation failed');
      }
      expect(batch1.data.events).toHaveLength(1);
      expect(batch1.data.events[0]?.sessionId).toBe(events[200]?.sessionId);
    });
  });

  describe('error and status handling', () => {
    it('throws an Error when response status is 500', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Internal Server Error' }), {
            status: 500,
            statusText: 'Internal Server Error',
          }),
        ),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      await expect(sender([createValidTestEvent(1)])).rejects.toThrowError(
        /HTTP 500/,
      );
    });

    it('does NOT throw when response status is 400 (considered permanent)', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'VALIDATION_ERROR',
              message: "Lot d'événements invalide",
            }),
            { status: 400, statusText: 'Bad Request' },
          ),
        ),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      await expect(sender([createValidTestEvent(1)])).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws an Error when response status is 429 (rate limited)', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'TOO_MANY_REQUESTS',
              message: 'Limite de requêtes atteinte',
            }),
            { status: 429, statusText: 'Too Many Requests' },
          ),
        ),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      await expect(sender([createValidTestEvent(1)])).rejects.toThrowError(
        /HTTP 429/,
      );
    });

    it('throws an Error when response status is 503 or other non-2xx statuses', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response('Service Unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
          }),
        ),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      await expect(sender([createValidTestEvent(1)])).rejects.toThrowError(
        /HTTP 503/,
      );
    });

    it('throws an Error when fetchFn rejects due to network error', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.reject(new Error('Network connection reset')),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      await expect(sender([createValidTestEvent(1)])).rejects.toThrowError(
        'Network connection reset',
      );
    });

    it('continues processing remaining chunks even if an earlier chunk returns 400', async () => {
      let callCount = 0;
      const mockFetch = vi.fn<typeof fetch>(() => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'invalid' }), {
              status: 400,
              statusText: 'Bad Request',
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ingested: 1 }), {
            status: 200,
            statusText: 'OK',
          }),
        );
      });

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      const events: Event[] = [];
      for (let i = 1; i <= 201; i += 1) {
        events.push(createValidTestEvent(i));
      }

      await expect(sender(events)).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('halts and throws when a subsequent chunk returns 500', async () => {
      let callCount = 0;
      const mockFetch = vi.fn<typeof fetch>(() => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ ingested: 200 }), {
              status: 200,
              statusText: 'OK',
            }),
          );
        }
        return Promise.resolve(
          new Response('Database failure', {
            status: 500,
            statusText: 'Internal Server Error',
          }),
        );
      });

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      const events: Event[] = [];
      for (let i = 1; i <= 201; i += 1) {
        events.push(createValidTestEvent(i));
      }

      await expect(sender(events)).rejects.toThrowError(/HTTP 500/);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration with createEventBatcher', () => {
    it('can be plugged directly into EventBatcher send option', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ingested: 1 }), {
            status: 200,
            statusText: 'OK',
          }),
        ),
      );

      const sender = createEventSender({
        apiBase: 'https://api.xplor.test',
        fetchFn: mockFetch,
      });

      const batcher = createEventBatcher({
        send: sender,
        maxBatch: 10,
        flushMs: 60_000,
      });

      batcher.push(createValidTestEvent(1));
      await batcher.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);

      batcher.destroy();
    });
  });
});
