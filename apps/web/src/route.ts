const shareTokenRegex = /^[A-Za-z0-9_-]{1,22}$/;

export function parseShareToken(pathname: string): string | null {
  if (!pathname.startsWith('/v/')) {
    return null;
  }
  let token = pathname.slice(3);
  if (token.endsWith('/')) {
    token = token.slice(0, -1);
  }
  if (!shareTokenRegex.test(token)) {
    return null;
  }
  return token;
}
