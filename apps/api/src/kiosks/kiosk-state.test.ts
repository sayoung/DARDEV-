import { describe, expect, it } from 'vitest';

import { computeConnectionState, OFFLINE_AFTER_MINUTES } from './kiosk-state.js';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const recentHeartbeat = new Date(NOW.getTime() - 5 * 60_000);

describe('computeConnectionState', () => {
  it('returns DISABLED for a disabled kiosk regardless of heartbeat or manifest', () => {
    expect(
      computeConnectionState(
        { status: 'DISABLED', lastHeartbeatAt: null, syncedManifestVersion: null },
        'expected',
        NOW,
      ),
    ).toBe('DISABLED');
  });

  it('returns PENDING for a pending kiosk regardless of heartbeat or manifest', () => {
    expect(
      computeConnectionState(
        { status: 'PENDING', lastHeartbeatAt: recentHeartbeat, syncedManifestVersion: null },
        'expected',
        NOW,
      ),
    ).toBe('PENDING');
  });

  it('returns OFFLINE for an active kiosk without a heartbeat', () => {
    expect(
      computeConnectionState(
        { status: 'ACTIVE', lastHeartbeatAt: null, syncedManifestVersion: 'expected' },
        'expected',
        NOW,
      ),
    ).toBe('OFFLINE');
  });

  it('returns OFFLINE when the heartbeat is older than 15 minutes', () => {
    const heartbeat = new Date(NOW.getTime() - (OFFLINE_AFTER_MINUTES * 60_000 + 1));

    expect(
      computeConnectionState(
        { status: 'ACTIVE', lastHeartbeatAt: heartbeat, syncedManifestVersion: 'expected' },
        'expected',
        NOW,
      ),
    ).toBe('OFFLINE');
  });

  it('does not mark the kiosk offline at exactly 15 minutes', () => {
    const heartbeat = new Date(NOW.getTime() - OFFLINE_AFTER_MINUTES * 60_000);

    expect(
      computeConnectionState(
        { status: 'ACTIVE', lastHeartbeatAt: heartbeat, syncedManifestVersion: 'expected' },
        'expected',
        NOW,
      ),
    ).toBe('ONLINE');
  });

  it('returns DESYNCHRONIZED when the active kiosk manifest differs from the expected version', () => {
    expect(
      computeConnectionState(
        { status: 'ACTIVE', lastHeartbeatAt: recentHeartbeat, syncedManifestVersion: 'old' },
        'expected',
        NOW,
      ),
    ).toBe('DESYNCHRONIZED');
  });

  it('returns ONLINE when the active kiosk is recent and synchronized', () => {
    expect(
      computeConnectionState(
        { status: 'ACTIVE', lastHeartbeatAt: recentHeartbeat, syncedManifestVersion: 'expected' },
        'expected',
        NOW,
      ),
    ).toBe('ONLINE');
  });

  it('returns ONLINE when no manifest version is expected', () => {
    expect(
      computeConnectionState(
        { status: 'ACTIVE', lastHeartbeatAt: recentHeartbeat, syncedManifestVersion: null },
        null,
        NOW,
      ),
    ).toBe('ONLINE');
  });
});
