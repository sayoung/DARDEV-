import type { Lang, Role } from '@xplor/shared';

import type { AuthTx } from './unit-of-work.js';

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

/** Nouveau mot de passe et remise à zéro du verrouillage (réinitialisation). */
export type PasswordUpdate = {
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
};

/** Compte créé par une invitation : inactif, mot de passe encore inutilisable. */
export type NewInvitedUser = {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  uiLang: Lang;
};

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string, db?: AuthTx): Promise<AuthUser | null>;
  updateLoginState(id: string, state: LoginStateUpdate): Promise<void>;
  updatePassword(id: string, state: PasswordUpdate, db?: AuthTx): Promise<void>;
  createInvited(input: NewInvitedUser): Promise<AuthUser>;
  /** Pose le mot de passe choisi et passe `active` à true. */
  activate(id: string, passwordHash: string, db?: AuthTx): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
