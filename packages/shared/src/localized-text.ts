import { z } from 'zod';

import { LANGS, type Lang } from './lang.js';

export const LocalizedTextSchema = z.object({
  fr: z.string().min(1),
  ar: z.string().optional(),
  en: z.string().optional(),
});

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
