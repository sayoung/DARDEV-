import { describe, expect, it } from 'vitest';

import { makeStatsDemoEvents } from '../../prisma/stats-demo.js';

describe('makeStatsDemoEvents (M7)', () => {
  it('creates an anonymized deterministic week with the three channels and QR scans', () => {
    const tours = [
      { id: '01990000-0000-7000-8000-000000000001', scenes: [{ id: '01990000-0000-7000-8000-000000000002' }] },
      { id: '01990000-0000-7000-8000-000000000003', scenes: [{ id: '01990000-0000-7000-8000-000000000004' }] },
    ];
    const now = new Date('2026-10-21T12:00:00.000Z');
    const events = makeStatsDemoEvents(tours, '01990000-0000-7000-8000-000000000005', now);
    const repeated = makeStatsDemoEvents(tours, '01990000-0000-7000-8000-000000000005', now);
    expect(events).toHaveLength(418);
    expect(events.map((event) => event.sessionId)).toEqual(repeated.map((event) => event.sessionId));
    expect(new Set(events.map((event) => event.channel))).toEqual(new Set(['WEB', 'KIOSK', 'VR']));
    expect(events.some((event) => event.type === 'QR_SHOWN' && event.channel === 'WEB')).toBe(true);
    expect(events.every((event) => event.hotelId === '01990000-0000-7000-8000-000000000005')).toBe(true);
    expect(events.every((event) => event.kioskId === null)).toBe(true);
  });

  it('requires a tour containing at least one scene', () => {
    expect(() => makeStatsDemoEvents([], null)).toThrow('Aucune visite publiée');
  });
});
