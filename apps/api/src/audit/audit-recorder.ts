import type { RecordAuditParams } from './audit.service.js';

export type { RecordAuditParams };

/** Enregistreur d'audit. `AuditService` en production, un faux ou `NOOP_AUDIT` dans les tests. */
export type AuditRecorder = {
  record(params: RecordAuditParams): Promise<void>;
};

export const NOOP_AUDIT: AuditRecorder = {
  record: (): Promise<void> => Promise.resolve(),
};
