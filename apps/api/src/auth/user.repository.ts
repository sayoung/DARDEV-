import type { Lang, Role } from '@xplor/shared';

/** Compte lu pour l'authentification. Remplaçable dans les tests. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  uiLang: Lang;
  active: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
};

/** Compteur de verrouillage, et date de connexion quand la tentative réussit. */
export type LoginStateUpdate = {
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt?: Date;
};

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  updateLoginState(id: string, state: LoginStateUpdate): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
