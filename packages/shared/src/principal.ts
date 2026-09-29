import type { Role } from './role.js';

export type Principal = {
  userId: string;
  role: Role;
  hotelIds: string[];
};
