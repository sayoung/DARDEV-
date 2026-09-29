import { z } from 'zod';

import { LANGS, type Lang } from './lang.js';

/**
 * Texte traduisible (cahier, section 5). `fr` est obligatoire et non vide.
 * `max`, s'il est fourni, limite chacune des trois langues (ex. `summary` ≤ 500).
 */
export function localizedText(options?: { max?: number }) {
  const max = options?.max;
  const field = (required: boolean) => {
    const base = required ? z.string().min(1) : z.string();
    return max === undefined ? base : base.max(max);
  };
  return z.object({
    fr: field(true),
    ar: field(false).optional(),
    en: field(false).optional(),
  });
}

/** Texte traduisible sans limite de longueur. */
export const LocalizedTextSchema = localizedText();

export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

const LangSchema = z.enum(LANGS);

export function localize(text: LocalizedText, lang: string): string {
  const parsed = LangSchema.safeParse(lang);
  if (!parsed.success) {
    throw new Error(`Unknown language: ${lang}`);
  }
  return readLocalized(text, parsed.data);
}

function readLocalized(text: LocalizedText, lang: Lang): string {
  if (lang === 'fr') {
    return text.fr;
  }
  const value = text[lang];
  if (value === undefined || value === '') {
    return text.fr;
  }
  return value;
}
