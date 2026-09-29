import { z } from 'zod';

/** Mot de passe d'un compte (F-90) : au moins 12 caractères. */
export const PasswordSchema = z.string().min(12);
