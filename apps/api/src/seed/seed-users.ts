import { Role } from '@xplor/shared';
import { ZodError } from 'zod';

import { PasswordTooCommonError, validateNewPassword } from '../auth/password.service.js';

/** Compte de démonstration, prêt pour un upsert Prisma sur `email`. */
export interface SeedUser {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  active: true;
  uiLang: 'fr';
}

const SEED_USERS = [
  { email: 'admin@xplor.local', name: 'Administrateur', role: Role.ADMIN },
  { email: 'editor@xplor.local', name: 'Éditeur', role: Role.EDITOR },
  { email: 'manager@xplor.local', name: 'Gestionnaire', role: Role.HOTEL_MANAGER },
  { email: 'partner@xplor.local', name: 'Partenaire', role: Role.PARTNER },
] as const;

/** `SEED_DEFAULT_PASSWORD` refusé par `validateNewPassword`. */
export class SeedPasswordRejectedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SeedPasswordRejectedError';
  }
}

/**
 * Quatre utilisateurs actifs, un par rôle. Le mot de passe en clair est validé ;
 * le hash argon2id est fourni par l'appelant (`PasswordService`).
 */
export function buildSeedUsers(password: string, hash: string): SeedUser[] {
  assertSeedPassword(password);
  return SEED_USERS.map((user) => ({
    email: user.email,
    name: user.name,
    passwordHash: hash,
    role: user.role,
    active: true as const,
    uiLang: 'fr' as const,
  }));
}

function assertSeedPassword(password: string): void {
  try {
    validateNewPassword(password);
  } catch (error: unknown) {
    throw new SeedPasswordRejectedError(seedPasswordMessage(error), { cause: error });
  }
}

function seedPasswordMessage(error: unknown): string {
  if (error instanceof PasswordTooCommonError) {
    return 'SEED_DEFAULT_PASSWORD refusé : ce mot de passe figure dans la liste des mots de passe courants.';
  }
  if (error instanceof ZodError) {
    return 'SEED_DEFAULT_PASSWORD refusé : le mot de passe doit contenir au moins 12 caractères.';
  }
  return 'SEED_DEFAULT_PASSWORD refusé.';
}
