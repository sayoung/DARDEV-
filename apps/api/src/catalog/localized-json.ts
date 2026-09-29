import { Prisma } from '@prisma/client';
import type { LocalizedText } from '@xplor/shared';

/** Objet JSON sans clé `undefined` : Prisma refuse `undefined` dans un champ Json. */
export function localizedToJson(text: LocalizedText): Prisma.InputJsonValue {
  const json: Record<string, string> = { fr: text.fr };
  if (text.ar !== undefined) {
    json.ar = text.ar;
  }
  if (text.en !== undefined) {
    json.en = text.en;
  }
  return json;
}
