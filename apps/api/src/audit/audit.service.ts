import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditActionSchema, type AuditAction } from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';

export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'password',
  'passwordHash',
  'token',
  'totpSecret',
  'secret',
]);

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEYS.has(key)) {
    return true;
  }
  const lower = key.toLowerCase();
  return (
    lower === 'password' ||
    lower === 'passwordhash' ||
    lower === 'password_hash' ||
    lower === 'token' ||
    lower === 'totpsecret' ||
    lower === 'totp_secret' ||
    lower === 'secret'
  );
}

/**
 * Fonction pure qui retire récursivement les clés sensibles d'un diff d'audit
 * (password, passwordHash, token, totpSecret, secret).
 * Ne mute jamais l'objet d'entrée.
 */
export function sanitizeAuditDiff(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditDiff(item));
  }

  if (value instanceof Date) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (!isSensitiveKey(key)) {
      sanitized[key] = sanitizeAuditDiff(val);
    }
  }
  return sanitized;
}

function toPrismaJsonValue(
  value: unknown,
): Prisma.InputJsonValue | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    const list: (Prisma.InputJsonValue | null)[] = [];
    for (const item of value) {
      const converted = toPrismaJsonValue(item);
      if (converted !== undefined) {
        list.push(converted);
      }
    }
    return list;
  }
  if (typeof value === 'object') {
    const obj: { [key: string]: Prisma.InputJsonValue | null } = {};
    for (const [k, v] of Object.entries(value)) {
      const converted = toPrismaJsonValue(v);
      if (converted !== undefined) {
        obj[k] = converted;
      }
    }
    return obj;
  }
  return undefined;
}

export interface RecordAuditParams {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  userId?: string | null;
  kioskId?: string | null;
  diff?: unknown;
  ip?: string | null;
}

export interface AuditPrismaClient {
  auditLog: {
    create(args: {
      data: Prisma.AuditLogUncheckedCreateInput;
    }): Promise<unknown>;
  };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: AuditPrismaClient,
  ) {}

  /**
   * Enregistre un événement dans le journal d'audit (F-91).
   * Le service ne lève jamais d'exception : en cas d'erreur Prisma,
   * il journalise l'erreur avec Logger et continue sans propager.
   */
  async record(params: RecordAuditParams): Promise<void> {
    try {
      const validatedAction = AuditActionSchema.safeParse(params.action);
      const action = validatedAction.success ? validatedAction.data : params.action;

      const data: Prisma.AuditLogUncheckedCreateInput = {
        action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        userId: params.userId ?? null,
        kioskId: params.kioskId ?? null,
        ip: params.ip ?? null,
      };

      if (params.diff === null) {
        data.diff = Prisma.DbNull;
      } else if (params.diff !== undefined) {
        const sanitized = sanitizeAuditDiff(params.diff);
        if (sanitized === null) {
          data.diff = Prisma.DbNull;
        } else {
          const jsonValue = toPrismaJsonValue(sanitized);
          if (jsonValue !== undefined && jsonValue !== null) {
            data.diff = jsonValue;
          }
        }
      }

      await this.prisma.auditLog.create({ data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Échec d'enregistrement dans le journal d'audit [${params.action} sur ${params.entityType}]: ${message}`,
        stack,
      );
    }
  }
}
