import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { HEALTH_CHECK_TIMEOUT_MS, HealthService, type HealthProbe } from './health.service.js';

const okProbe: HealthProbe = {
  run: () => Promise.resolve(),
};

describe('HealthService', () => {
  it('returns 200 when every check succeeds', async () => {
    const service = new HealthService(okProbe, okProbe, okProbe);
    const report = await service.check();

    expect(report.statusCode).toBe(200);
    expect(report.body).toEqual({
      status: 'ok',
      checks: { db: 'ok', redis: 'ok', storage: 'ok' },
    });
  });

  it("returns 503 with checks.redis = 'error' when Redis fails", async () => {
    const redisDown: HealthProbe = {
      run: () => Promise.reject(new Error('redis down')),
    };
    const service = new HealthService(okProbe, redisDown, okProbe);
    const report = await service.check();

    expect(report.statusCode).toBe(503);
    expect(report.body.status).toBe('error');
    expect(report.body.checks.redis).toBe('error');
    expect(report.body.checks.db).toBe('ok');
    expect(report.body.checks.storage).toBe('ok');
  });

  it('counts a check that exceeds 2s as an error', async () => {
    vi.useFakeTimers();
    try {
      const hanging: HealthProbe = {
        run: () =>
          new Promise<void>(() => {
            // Reste en attente au-delà du délai maximal.
          }),
      };
      const service = new HealthService(hanging, okProbe, okProbe);
      const pending = service.check();
      await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);
      const report = await pending;

      expect(report.statusCode).toBe(503);
      expect(report.body.status).toBe('error');
      expect(report.body.checks.db).toBe('error');
      expect(report.body.checks.redis).toBe('ok');
      expect(report.body.checks.storage).toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });
});
