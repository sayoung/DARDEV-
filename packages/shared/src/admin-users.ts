import { z } from 'zod';

import { LANGS } from './lang.js';
import { Role } from './role.js';

/**
 * Coercition en booléen adaptée aux query strings HTTP (`?active=true`, `?active=false`).
 */
const activeQuerySchema = z
  .preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'true' || lower === '1') {
        return true;
      }
      if (lower === 'false' || lower === '0') {
        return false;
      }
    }
    return val;
  }, z.coerce.boolean())
  .optional();

/**
 * Représentation d'un utilisateur renvoyée par l'API admin (API-28, F-90).
 * Ne doit jamais exposer `passwordHash` ni `totpSecret`.
 */
export const AdminUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().trim().min(1),
  role: z.enum(Role),
  active: z.boolean(),
  totpEnabled: z.boolean(),
  lastLoginAt: z.iso.datetime().nullable(),
  uiLang: z.enum(LANGS),
  hotelIds: z.array(z.uuid()),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;

/**
 * Corps de mise à jour partielle d'un compte utilisateur (API-28).
 * Au moins un des champs modifiables doit être renseigné.
 */
export const UpdateAdminUserRequestSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    role: z.enum(Role).optional(),
    active: z.boolean().optional(),
    uiLang: z.enum(LANGS).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.role !== undefined ||
      data.active !== undefined ||
      data.uiLang !== undefined,
    {
      message: 'Au moins un champ doit être fourni pour la mise à jour',
    },
  );

export type UpdateAdminUserRequest = z.infer<typeof UpdateAdminUserRequestSchema>;

/**
 * Corps d'assignation des hôtels rattachés à un utilisateur (API-28).
 */
export const SetUserHotelsRequestSchema = z.object({
  hotelIds: z.array(z.uuid()),
});

export type SetUserHotelsRequest = z.infer<typeof SetUserHotelsRequestSchema>;

/**
 * Paramètres de filtrage et de pagination de la liste des utilisateurs (API-28).
 */
export const AdminUserListQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  role: z.enum(Role).optional(),
  active: activeQuerySchema,
  q: z.string().trim().optional(),
});

export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

/**
 * Réponse paginée de consultation des utilisateurs (API-28).
 */
export const PaginatedAdminUsersResponseSchema = z.object({
  items: z.array(AdminUserSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
});

export type PaginatedAdminUsersResponse = z.infer<typeof PaginatedAdminUsersResponseSchema>;
