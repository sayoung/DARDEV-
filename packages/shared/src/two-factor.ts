import { z } from 'zod';

/**
 * Expression régulière pour un code TOTP à exactement 6 chiffres (M8 F-90).
 */
export const twoFactorCodeRegex = /^\d{6}$/;

/**
 * Schéma Zod pour un code TOTP à 6 chiffres (M8 F-90).
 * Refuse tout code ne contenant pas exactement 6 chiffres décimaux.
 */
export const TwoFactorCodeSchema = z
  .string()
  .regex(twoFactorCodeRegex, 'Le code doit contenir exactement 6 chiffres');

/**
 * Schéma Zod pour la réponse d'initialisation de la 2FA (M8 F-90).
 * Contient le secret TOTP en base32 et l'URI otpauth.
 */
export const TwoFactorSetupResponseSchema = z.object({
  secret: z.string().min(1),
  otpauthUri: z.string().min(1),
});

export const TwoFactorSetupResponse = TwoFactorSetupResponseSchema;
export type TwoFactorSetupResponse = z.infer<typeof TwoFactorSetupResponseSchema>;

/**
 * Schéma Zod pour confirmer l'activation ou désactiver la 2FA (M8 F-90).
 * Exige un code TOTP composé d'exactement 6 chiffres.
 */
export const TwoFactorCodeBodySchema = z.object({
  code: TwoFactorCodeSchema,
});

export const TwoFactorCodeBody = TwoFactorCodeBodySchema;
export type TwoFactorCodeBody = z.infer<typeof TwoFactorCodeBodySchema>;

/**
 * Schéma Zod pour le challenge 2FA lors de la connexion (M8 F-90).
 * Exige le code TOTP à 6 chiffres.
 */
export const LoginTwoFactorBodySchema = z.object({
  code: TwoFactorCodeSchema,
});

export const LoginTwoFactorBody = LoginTwoFactorBodySchema;
export type LoginTwoFactorBody = z.infer<typeof LoginTwoFactorBodySchema>;
