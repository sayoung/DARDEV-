import { LANGS, type Lang } from '@xplor/shared';

const shareTokenRegex = /^[A-Za-z0-9_-]{1,22}$/;
const previewTokenRegex = /^[A-Za-z0-9_-]{1,200}\.[A-Za-z0-9_-]{1,100}$/;

export type ViewerRoute = { kind: 'share'; token: string } | { kind: 'preview'; token: string };

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

export function parseViewerRoute(pathname: string): ViewerRoute | null {
  if (!pathname.startsWith('/v/')) {
    return null;
  }

  let rest = pathname.slice(3);
  if (rest.endsWith('/')) {
    rest = rest.slice(0, -1);
  }

  if (rest === 'preview' || rest.startsWith('preview/')) {
    const previewToken = rest.slice(8);
    if (previewTokenRegex.test(previewToken)) {
      return { kind: 'preview', token: previewToken };
    }
    return null;
  }

  const shareToken = parseShareToken(pathname);
  if (shareToken !== null) {
    return { kind: 'share', token: shareToken };
  }

  return null;
}

export function resolveLang(search: string): Lang {
  const requested = new URLSearchParams(search).get('lang');
  for (const lang of LANGS) {
    if (lang === requested) {
      return lang;
    }
  }
  return 'fr';
}
