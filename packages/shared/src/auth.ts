import { z } from 'zod';

import { LANGS } from './lang.js';
import { Role } from './role.js';

/** Corps de `POST /auth/login` (API-20). */
export const LoginRequestSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Profil renvoyé par `login` et `me` (API-20). */
export const MeResponseSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  role: z.enum(Role),
  uiLang: z.enum(LANGS),
  csrfToken: z.string().min(1),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;
