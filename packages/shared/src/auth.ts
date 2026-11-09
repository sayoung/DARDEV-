import { z } from 'zod';

import { LANGS } from './lang.js';
import { PasswordSchema } from './password.js';
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
  totpEnabled: z.boolean(),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

/** Réponse renvoyée par `login` lorsqu'un second facteur TOTP est requis (API-20, F-90). */
export const TwoFactorRequiredResponseSchema = z.object({
  twoFactorRequired: z.literal(true),
});

export type TwoFactorRequiredResponse = z.infer<typeof TwoFactorRequiredResponseSchema>;

/** Réponse à `POST /auth/login` (API-20, F-90) : profil complet avec session ou étape 2FA requise. */
export const LoginResponseSchema = z.union([MeResponseSchema, TwoFactorRequiredResponseSchema]);

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** Corps de `POST /auth/login/2fa` (API-20, F-90). */
export const Login2faRequestSchema = z.object({
  code: z.string().trim().min(6).max(12),
});

export type Login2faRequest = z.infer<typeof Login2faRequestSchema>;

/** Corps de `POST /auth/password/forgot` (API-20). */
export const ForgotPasswordRequestSchema = z.object({
  email: z.email(),
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

/** Corps de `POST /auth/password/reset` (API-20). Le mot de passe suit `PasswordSchema`. */
export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

/** Corps de `POST /admin/users/invitations` (API-28, invitation F-90). */
export const InviteUserRequestSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
  role: z.enum(Role),
  uiLang: z.enum(LANGS),
});

export type InviteUserRequest = z.infer<typeof InviteUserRequestSchema>;

/** Compte créé par l'invitation. Il reste inactif jusqu'à l'acceptation. */
export const InviteUserResponseSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  role: z.enum(Role),
});

export type InviteUserResponse = z.infer<typeof InviteUserResponseSchema>;

/** Corps de `POST /auth/invite/accept` (API-20). Le mot de passe suit `PasswordSchema`. */
export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,
});

export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;
