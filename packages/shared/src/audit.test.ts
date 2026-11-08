import { describe, expect, it } from 'vitest';

import {
  AUDIT_ACTIONS,
  AuditActionSchema,
  AuditLogEntrySchema,
  AuditLogQuerySchema,
  PaginatedAuditLogResponseSchema,
  type AuditAction,
  type AuditLogEntry,
  type AuditLogQuery,
  type PaginatedAuditLogResponse,
} from './audit.js';

const validEntryId = '01990000-0000-7000-8000-000000000001';
const validUserId = '01990000-0000-7000-8000-000000000002';
const validKioskId = '01990000-0000-7000-8000-000000000003';
const isoCreatedAt = '2026-11-07T12:00:00.000Z';

function makeValidEntry(): AuditLogEntry {
  return {
    id: validEntryId,
    userId: validUserId,
    kioskId: validKioskId,
    action: 'tour.publish',
    entityType: 'Tour',
    entityId: '01990000-0000-7000-8000-000000000004',
    diff: { before: { status: 'DRAFT' }, after: { status: 'PUBLISHED' } },
    ip: '192.168.1.10',
    createdAt: isoCreatedAt,
  };
}

describe('AuditActionSchema', () => {
  it('contient exactement les 9 actions fermées du cahier des charges', () => {
    expect(AUDIT_ACTIONS).toEqual([
      'auth.login',
      'auth.login_failed',
      'tour.publish',
      'tour.unpublish',
      'entity.delete',
      'kiosk.create',
      'kiosk.disable',
      'selection.update',
      'user.role_change',
    ]);
  });

  it('accepte chacune des actions valides', () => {
    for (const action of AUDIT_ACTIONS) {
      const typedAction: AuditAction = action;
      const parsed = AuditActionSchema.safeParse(typedAction);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe(action);
      }
    }
  });

  it('refuse une action inconnue', () => {
    const unknownActions = [
      'auth.logout',
      'tour.delete',
      'user.create',
      'random_action',
      '',
    ];
    for (const unknown of unknownActions) {
      const result = AuditActionSchema.safeParse(unknown);
      expect(result.success).toBe(false);
    }
  });
});

describe('AuditLogEntrySchema', () => {
  it('valide une entrée complète avec des valeurs valides', () => {
    const entry = makeValidEntry();
    const result = AuditLogEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(validEntryId);
      expect(result.data.userId).toBe(validUserId);
      expect(result.data.kioskId).toBe(validKioskId);
      expect(result.data.action).toBe('tour.publish');
      expect(result.data.entityType).toBe('Tour');
      expect(result.data.ip).toBe('192.168.1.10');
      expect(result.data.createdAt).toBe(isoCreatedAt);
    }
  });

  it('valide une entrée avec champs optionnels nuls ou absents', () => {
    const minimalEntry = {
      id: validEntryId,
      userId: null,
      kioskId: null,
      action: 'auth.login_failed',
      entityType: 'Auth',
      entityId: null,
      diff: null,
      ip: null,
      createdAt: isoCreatedAt,
    };
    const result = AuditLogEntrySchema.safeParse(minimalEntry);
    expect(result.success).toBe(true);
  });

  it('accepte une entrée dont les champs optionnels sont omis', () => {
    const omittedEntry = {
      id: validEntryId,
      action: 'auth.login',
      entityType: 'User',
      createdAt: isoCreatedAt,
    };
    const result = AuditLogEntrySchema.safeParse(omittedEntry);
    expect(result.success).toBe(true);
  });

  it('refuse une action inconnue dans une entrée', () => {
    const invalidEntry = {
      ...makeValidEntry(),
      action: 'tour.destroy',
    };
    const result = AuditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });

  it('refuse un id non-UUID', () => {
    const invalidEntry = {
      ...makeValidEntry(),
      id: 'invalid-id',
    };
    const result = AuditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });

  it('refuse un userId non-UUID lorsqu’il est renseigné', () => {
    const invalidEntry = {
      ...makeValidEntry(),
      userId: 'not-a-uuid',
    };
    const result = AuditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });

  it('refuse un kioskId non-UUID lorsqu’il est renseigné', () => {
    const invalidEntry = {
      ...makeValidEntry(),
      kioskId: 'not-a-uuid',
    };
    const result = AuditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });

  it('refuse un entityType vide', () => {
    const invalidEntry = {
      ...makeValidEntry(),
      entityType: '',
    };
    const result = AuditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });

  it('refuse une date createdAt qui n’est pas au format ISO 8601', () => {
    const invalidEntry = {
      ...makeValidEntry(),
      createdAt: '2026/11/07 12:00:00',
    };
    const result = AuditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });
});

describe('AuditLogQuerySchema', () => {
  it('valide une requête avec toutes les valeurs valides', () => {
    const query: AuditLogQuery = {
      action: 'selection.update',
      entityType: 'Selection',
      userId: validUserId,
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.999Z',
      page: 2,
      pageSize: 25,
    };
    const result = AuditLogQuerySchema.safeParse(query);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('selection.update');
      expect(result.data.entityType).toBe('Selection');
      expect(result.data.userId).toBe(validUserId);
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(25);
    }
  });

  it('applique les valeurs par défaut (page: 1, pageSize: 50) sur une requête vide', () => {
    const result = AuditLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(50);
      expect(result.data.action).toBeUndefined();
      expect(result.data.entityType).toBeUndefined();
      expect(result.data.userId).toBeUndefined();
      expect(result.data.from).toBeUndefined();
      expect(result.data.to).toBeUndefined();
    }
  });

  it('accepte from seul ou to seul', () => {
    const onlyFrom = AuditLogQuerySchema.safeParse({ from: '2026-10-01T00:00:00.000Z' });
    expect(onlyFrom.success).toBe(true);

    const onlyTo = AuditLogQuerySchema.safeParse({ to: '2026-10-31T23:59:59.999Z' });
    expect(onlyTo.success).toBe(true);
  });

  it('accepte from == to (from ≤ to)', () => {
    const sameDate = '2026-10-15T12:00:00.000Z';
    const result = AuditLogQuerySchema.safeParse({ from: sameDate, to: sameDate });
    expect(result.success).toBe(true);
  });

  it('accepte des dates au format date seule YYYY-MM-DD', () => {
    const result = AuditLogQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-31' });
    expect(result.success).toBe(true);
  });

  it('refuse from > to', () => {
    const result = AuditLogQuerySchema.safeParse({
      from: '2026-10-31T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['to']);
    }
  });

  it('refuse from > to avec des dates seules YYYY-MM-DD', () => {
    const result = AuditLogQuerySchema.safeParse({
      from: '2026-11-10',
      to: '2026-11-05',
    });
    expect(result.success).toBe(false);
  });

  it('refuse pageSize > 100', () => {
    const result = AuditLogQuerySchema.safeParse({ pageSize: 101 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['pageSize']);
    }
  });

  it('accepte la borne pageSize = 100 et pageSize = 1', () => {
    expect(AuditLogQuerySchema.safeParse({ pageSize: 100 }).success).toBe(true);
    expect(AuditLogQuerySchema.safeParse({ pageSize: 1 }).success).toBe(true);
  });

  it('refuse pageSize < 1 ou non entier', () => {
    expect(AuditLogQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(AuditLogQuerySchema.safeParse({ pageSize: -5 }).success).toBe(false);
    expect(AuditLogQuerySchema.safeParse({ pageSize: 25.5 }).success).toBe(false);
  });

  it('refuse page < 1 ou non entier', () => {
    expect(AuditLogQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(AuditLogQuerySchema.safeParse({ page: -1 }).success).toBe(false);
    expect(AuditLogQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
  });

  it('refuse une action inconnue dans la query', () => {
    const result = AuditLogQuerySchema.safeParse({ action: 'unknown.action' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['action']);
    }
  });

  it('refuse un userId invalide dans la query', () => {
    const result = AuditLogQuerySchema.safeParse({ userId: 'not-a-valid-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['userId']);
    }
  });

  it('refuse des dates invalides dans from ou to', () => {
    expect(AuditLogQuerySchema.safeParse({ from: 'date-invalide' }).success).toBe(false);
    expect(AuditLogQuerySchema.safeParse({ to: '2026/10/01' }).success).toBe(false);
  });
});

describe('PaginatedAuditLogResponseSchema', () => {
  it('valide une réponse paginée complète avec une liste d entrées', () => {
    const entry = makeValidEntry();
    const payload: PaginatedAuditLogResponse = {
      items: [entry],
      total: 1,
      page: 1,
      pageSize: 50,
    };
    const result = PaginatedAuditLogResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it('valide une réponse avec liste vide et total à 0', () => {
    const result = PaginatedAuditLogResponseSchema.safeParse({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
    expect(result.success).toBe(true);
  });

  it('refuse un total négatif', () => {
    const result = PaginatedAuditLogResponseSchema.safeParse({
      items: [],
      total: -1,
      page: 1,
      pageSize: 50,
    });
    expect(result.success).toBe(false);
  });

  it('refuse une page inférieure à 1', () => {
    const result = PaginatedAuditLogResponseSchema.safeParse({
      items: [],
      total: 0,
      page: 0,
      pageSize: 50,
    });
    expect(result.success).toBe(false);
  });

  it('refuse un pageSize supérieur à 100', () => {
    const result = PaginatedAuditLogResponseSchema.safeParse({
      items: [],
      total: 0,
      page: 1,
      pageSize: 101,
    });
    expect(result.success).toBe(false);
  });

  it('refuse un élément de items qui ne respecte pas AuditLogEntrySchema', () => {
    const result = PaginatedAuditLogResponseSchema.safeParse({
      items: [{ id: 'invalid-id' }],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    expect(result.success).toBe(false);
  });
});
