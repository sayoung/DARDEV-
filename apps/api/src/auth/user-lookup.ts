import type { Role } from '@xplor/shared';

/** Compte chargé pour construire un `Principal`. Les hôtels de `UserHotel` ne sont pas encore chargés ici. */
export type SessionUser = {
  id: string;
  role: Role;
  active: boolean;
};

export interface UserLookup {
  findById(id: string): Promise<SessionUser | null>;
}

export const USER_LOOKUP = Symbol('USER_LOOKUP');
