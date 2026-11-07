import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  AuditService,
  sanitizeAuditDiff,
  SENSITIVE_KEYS,
  type AuditPrismaClient,
} from './audit.service.js';

interface AuditLogCreateCall {
  data: Prisma.AuditLogUncheckedCreateInput;
}

class FakeAuditPrismaClient implements AuditPrismaClient {
  public calls: AuditLogCreateCall[] = [];
  public shouldFail = false;
  public failureError: Error = new Error('Database connection failed');

  public readonly auditLog = {
    create: (args: {
      data: Prisma.AuditLogUncheckedCreateInput;
    }): Promise<unknown> => {
      if (this.shouldFail) {
        return Promise.reject(this.failureError);
      }
      this.calls.push(args);
      return Promise.resolve({
        id: '01990000-0000-7000-8000-000000000001',
        ...args.data,
      });
    },
  };
}

describe('sanitizeAuditDiff', () => {
  it('contient les clés sensibles attendues dans SENSITIVE_KEYS', () => {
    expect(SENSITIVE_KEYS.has('password')).toBe(true);
    expect(SENSITIVE_KEYS.has('passwordHash')).toBe(true);
    expect(SENSITIVE_KEYS.has('token')).toBe(true);
    expect(SENSITIVE_KEYS.has('totpSecret')).toBe(true);
    expect(SENSITIVE_KEYS.has('secret')).toBe(true);
  });

  it('retire les clés sensibles au premier niveau', () => {
    const input = {
      name: 'Hôtel Atlas',
      password: 'clearPassword123',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$abc',
      token: 'session-token-xyz',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      secret: 'app-secret-key',
      active: true,
    };

    const sanitized = sanitizeAuditDiff(input);

    expect(sanitized).toEqual({
      name: 'Hôtel Atlas',
      active: true,
    });
  });

  it('retire récursivement les clés sensibles dans des objets imbriqués', () => {
    const input = {
      user: {
        id: 'user-1',
        email: 'admin@xplor.ma',
        auth: {
          password: 'secretPassword',
          passwordHash: 'hash123',
          totpSecret: 'totp123',
        },
      },
      security: {
        api: {
          token: 'bearer-token',
          secret: 'secret-key',
        },
        level: 'high',
      },
    };

    const sanitized = sanitizeAuditDiff(input);

    expect(sanitized).toEqual({
      user: {
        id: 'user-1',
        email: 'admin@xplor.ma',
        auth: {},
      },
      security: {
        api: {},
        level: 'high',
      },
    });
  });

  it('retire récursivement les clés sensibles dans les tableaux et tableaux imbriqués', () => {
    const input = {
      tokens: [
        { id: 1, token: 'token-1', label: 'kiosk A' },
        { id: 2, token: 'token-2', label: 'kiosk B' },
      ],
      nestedGroups: [
        {
          group: 'admins',
          members: [
            { name: 'Alice', password: 'p1', passwordHash: 'h1' },
            { name: 'Bob', totpSecret: 's2', role: 'ADMIN' },
          ],
        },
      ],
    };

    const sanitized = sanitizeAuditDiff(input);

    expect(sanitized).toEqual({
      tokens: [
        { id: 1, label: 'kiosk A' },
        { id: 2, label: 'kiosk B' },
      ],
      nestedGroups: [
        {
          group: 'admins',
          members: [
            { name: 'Alice' },
            { name: 'Bob', role: 'ADMIN' },
          ],
        },
      ],
    });
  });

  it('ne mute pas l’objet d’entrée original (fonction pure)', () => {
    const original = {
      username: 'test',
      password: 'clearPassword',
      details: {
        token: 'token123',
        score: 42,
      },
    };

    const copy = structuredClone(original);
    const sanitized = sanitizeAuditDiff(original);

    expect(original).toEqual(copy);
    expect(sanitized).toEqual({
      username: 'test',
      details: {
        score: 42,
      },
    });
  });

  it('gère correctement les valeurs null, undefined et primitives', () => {
    expect(sanitizeAuditDiff(null)).toBeNull();
    expect(sanitizeAuditDiff(undefined)).toBeUndefined();
    expect(sanitizeAuditDiff('chaine')).toBe('chaine');
    expect(sanitizeAuditDiff(123)).toBe(123);
    expect(sanitizeAuditDiff(true)).toBe(true);
    expect(sanitizeAuditDiff(false)).toBe(false);

    const date = new Date('2026-11-07T12:00:00.000Z');
    expect(sanitizeAuditDiff(date)).toBe(date);
  });
});

describe('AuditService', () => {
  it('écrit correctement un log complet dans Prisma avec diff assaini', async () => {
    const fakePrisma = new FakeAuditPrismaClient();
    const service = new AuditService(fakePrisma);

    await service.record({
      action: 'tour.publish',
      entityType: 'Tour',
      entityId: '01990000-0000-7000-8000-000000000101',
      userId: '01990000-0000-7000-8000-000000000201',
      kioskId: '01990000-0000-7000-8000-000000000301',
      diff: {
        title: 'Visite des Oudayas',
        password: 'shouldBeRemoved',
        credentials: {
          token: 'shouldAlsoBeRemoved',
        },
        version: 2,
      },
      ip: '192.168.1.50',
    });

    expect(fakePrisma.calls).toHaveLength(1);
    const firstCall = fakePrisma.calls[0];
    expect(firstCall?.data).toEqual({
      action: 'tour.publish',
      entityType: 'Tour',
      entityId: '01990000-0000-7000-8000-000000000101',
      userId: '01990000-0000-7000-8000-000000000201',
      kioskId: '01990000-0000-7000-8000-000000000301',
      diff: {
        title: 'Visite des Oudayas',
        credentials: {},
        version: 2,
      },
      ip: '192.168.1.50',
    });
  });

  it('enregistre les champs optionnels manquants avec la valeur null', async () => {
    const fakePrisma = new FakeAuditPrismaClient();
    const service = new AuditService(fakePrisma);

    await service.record({
      action: 'auth.login',
      entityType: 'User',
    });

    expect(fakePrisma.calls).toHaveLength(1);
    const firstCall = fakePrisma.calls[0];
    expect(firstCall?.data).toEqual({
      action: 'auth.login',
      entityType: 'User',
      entityId: null,
      userId: null,
      kioskId: null,
      ip: null,
    });
  });

  it('convertit un diff explicite null en Prisma.DbNull', async () => {
    const fakePrisma = new FakeAuditPrismaClient();
    const service = new AuditService(fakePrisma);

    await service.record({
      action: 'entity.delete',
      entityType: 'Scene',
      entityId: '01990000-0000-7000-8000-000000000401',
      diff: null,
    });

    expect(fakePrisma.calls).toHaveLength(1);
    const firstCall = fakePrisma.calls[0];
    expect(firstCall?.data.diff).toBe(Prisma.DbNull);
  });

  it('convertit une date présente dans le diff en chaîne ISO', async () => {
    const fakePrisma = new FakeAuditPrismaClient();
    const service = new AuditService(fakePrisma);

    const now = new Date('2026-11-07T18:30:00.000Z');
    await service.record({
      action: 'kiosk.create',
      entityType: 'Kiosk',
      diff: {
        enrolledAt: now,
      },
    });

    expect(fakePrisma.calls).toHaveLength(1);
    const firstCall = fakePrisma.calls[0];
    expect(firstCall?.data.diff).toEqual({
      enrolledAt: '2026-11-07T18:30:00.000Z',
    });
  });

  it('avale et journalise une erreur Prisma sans lever d’exception', async () => {
    const fakePrisma = new FakeAuditPrismaClient();
    fakePrisma.shouldFail = true;
    fakePrisma.failureError = new Error('Prisma error: connection reset by peer');

    const service = new AuditService(fakePrisma);

    const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    await expect(
      service.record({
        action: 'auth.login_failed',
        entityType: 'User',
        ip: '10.0.0.1',
      }),
    ).resolves.toBeUndefined();

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    const firstCallArgs = loggerSpy.mock.calls[0];
    const loggedMessage = typeof firstCallArgs?.[0] === 'string' ? firstCallArgs[0] : '';
    expect(loggedMessage).toContain('auth.login_failed');
    expect(loggedMessage).toContain('User');
    expect(loggedMessage).toContain('connection reset by peer');

    loggerSpy.mockRestore();
  });
});
