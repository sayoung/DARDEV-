import { Inject, Injectable } from '@nestjs/common';

export const HEALTH_CHECK_TIMEOUT_MS = 2_000;

export const DB_HEALTH_PROBE = Symbol('DB_HEALTH_PROBE');
export const REDIS_HEALTH_PROBE = Symbol('REDIS_HEALTH_PROBE');
export const STORAGE_HEALTH_PROBE = Symbol('STORAGE_HEALTH_PROBE');

export type HealthCheckStatus = 'ok' | 'error';

export interface HealthChecks {
  db: HealthCheckStatus;
  redis: HealthCheckStatus;
  storage: HealthCheckStatus;
}

export interface HealthBody {
  status: HealthCheckStatus;
  checks: HealthChecks;
}

export interface HealthReport {
  statusCode: 200 | 503;
  body: HealthBody;
}

export interface HealthProbe {
  run(): Promise<void>;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DB_HEALTH_PROBE) private readonly db: HealthProbe,
    @Inject(REDIS_HEALTH_PROBE) private readonly redis: HealthProbe,
    @Inject(STORAGE_HEALTH_PROBE) private readonly storage: HealthProbe,
  ) {}

  async check(): Promise<HealthReport> {
    const [db, redis, storage] = await Promise.all([
      this.settle(this.db),
      this.settle(this.redis),
      this.settle(this.storage),
    ]);
    const checks: HealthChecks = { db, redis, storage };
    const ok = db === 'ok' && redis === 'ok' && storage === 'ok';
    return {
      statusCode: ok ? 200 : 503,
      body: {
        status: ok ? 'ok' : 'error',
        checks,
      },
    };
  }

  private async settle(probe: HealthProbe): Promise<HealthCheckStatus> {
    try {
      await withTimeout(probe.run(), HEALTH_CHECK_TIMEOUT_MS);
      return 'ok';
    } catch {
      return 'error';
    }
  }
}

function withTimeout(work: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('health check timed out'));
    }, ms);
    timer.unref();
    void work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('health check failed'));
      },
    );
  });
}
