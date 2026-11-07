import { z } from 'zod';

/**
 * Liste fermée des actions tracées dans le journal d'audit (cahier des charges §5.10, §6.10 F-91).
 */
export const AuditActionSchema = z.enum([
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

export type AuditAction = z.infer<typeof AuditActionSchema>;
export const AUDIT_ACTIONS = AuditActionSchema.options;

/**
 * Entrée unitaire du journal d'audit (F-91, API-30).
 * - id : identifiant unique de l'entrée (UUID)
 * - userId : identifiant de l'utilisateur ayant réalisé l'action (facultatif / nul pour les actions système/kiosque)
 * - kioskId : identifiant du kiosque concerné (facultatif / nul)
 * - action : action auditée parmi la liste fermée AuditAction
 * - entityType : type d'entité ciblée (User, Tour, Kiosk, Selection, etc.)
 * - entityId : identifiant de l'entité ciblée (facultatif / nul)
 * - diff : modifications apportées (avant/après ou payload JSON facultatif / nul)
 * - ip : adresse IP de l'appelant (facultatif / nul)
 * - createdAt : horodatage ISO 8601 de l'événement
 */
export const AuditLogEntrySchema = z.object({
  id: z.uuid(),
  userId: z.uuid().nullable().optional(),
  kioskId: z.uuid().nullable().optional(),
  action: AuditActionSchema,
  entityType: z.string().min(1),
  entityId: z.string().nullable().optional(),
  diff: z.unknown().nullable().optional(),
  ip: z.string().nullable().optional(),
  createdAt: z.iso.datetime(),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

const dateSchema = z.union([
  z.iso.datetime({ offset: true }),
  z.iso.date(),
  z.date(),
]);

function isDateRangeValid(from?: string | Date, to?: string | Date): boolean {
  if (from !== undefined && to !== undefined) {
    const fromTime = typeof from === 'string' ? new Date(from).getTime() : from.getTime();
    const toTime = typeof to === 'string' ? new Date(to).getTime() : to.getTime();
    return fromTime <= toTime;
  }
  return true;
}

/**
 * Paramètres de filtrage et pagination du journal d'audit (F-91, API-30).
 * - action : filtrer par type d'action
 * - entityType : filtrer par type d'entité
 * - userId : filtrer par identifiant utilisateur (UUID)
 * - from / to : bornes temporelles (avec from ≤ to)
 * - page : numéro de page (≥ 1, défaut 1)
 * - pageSize : taille de page (1…100, défaut 50)
 */
export const AuditLogQuerySchema = z
  .object({
    action: AuditActionSchema.optional(),
    entityType: z.string().min(1).optional(),
    userId: z.uuid().optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(50),
  })
  .refine((data) => isDateRangeValid(data.from, data.to), {
    message: 'La date de début doit être antérieure ou égale à la date de fin',
    path: ['to'],
  });

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
