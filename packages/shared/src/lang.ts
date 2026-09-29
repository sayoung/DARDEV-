export const LANGS = ['fr', 'ar', 'en'] as const;

export type Lang = (typeof LANGS)[number];
