import { describe, expect, it } from 'vitest';

import { NOOP_AUDIT, type AuditRecorder, type RecordAuditParams } from './audit-recorder.js';

describe('NOOP_AUDIT', () => {
  it('se résout sans erreur lors de l appel à record', async () => {
    const params: RecordAuditParams = {
      action: 'auth.login',
      entityType: 'User',
      entityId: '01990000-0000-7000-8000-000000000001',
      userId: '01990000-0000-7000-8000-000000000001',
      diff: { reason: 'test' },
      ip: '127.0.0.1',
    };

    await expect(NOOP_AUDIT.record(params)).resolves.toBeUndefined();
  });

  it('se résout sans erreur avec des paramètres minimaux', async () => {
    const minimalParams: RecordAuditParams = {
      action: 'tour.publish',
      entityType: 'Tour',
    };

    await expect(NOOP_AUDIT.record(minimalParams)).resolves.toBeUndefined();
  });

  it('respecte le contrat de type AuditRecorder', () => {
    const recorder: AuditRecorder = NOOP_AUDIT;
    expect(typeof recorder.record).toBe('function');
  });
});
