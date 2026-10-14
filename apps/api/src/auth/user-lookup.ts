import type { Role } from '@xplor/shared';

export type SessionUser = {
  id: string;
  role: Role;
  active: boolean;
  hotelIds?: string[];
};

export interface UserLookup {
  findById(id: string): Promise<SessionUser | null>;
}

export const USER_LOOKUP = Symbol('USER_LOOKUP');
