/** Nom du cookie de session (httpOnly). La valeur est l'identifiant opaque, pas un jeton signé. */
export const SESSION_COOKIE_NAME = 'xplor_sid';

export function readSessionId(request: {
  cookies?: Partial<Record<string, string | undefined>>;
}): string | null {
  const value = request.cookies?.[SESSION_COOKIE_NAME];
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return value;
}
