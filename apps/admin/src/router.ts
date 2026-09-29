import { useSyncExternalStore } from 'react';

export type Notice = 'reset' | 'invite';

export type AppRoute =
  | { name: 'session' }
  | { name: 'forgot' }
  | { name: 'reset'; token: string }
  | { name: 'invite'; token: string };

const RESET_PATH = /^\/reset\/([^/]+)$/;
const INVITE_PATH = /^\/invite\/([^/]+)$/;

export function parsePathname(pathname: string): AppRoute {
  if (pathname === '/forgot') {
    return { name: 'forgot' };
  }
  const resetToken = RESET_PATH.exec(pathname)?.[1];
  if (resetToken !== undefined) {
    return { name: 'reset', token: decodeSegment(resetToken) };
  }
  const inviteToken = INVITE_PATH.exec(pathname)?.[1];
  if (inviteToken !== undefined) {
    return { name: 'invite', token: decodeSegment(inviteToken) };
  }
  return { name: 'session' };
}

export function readNotice(search: string): Notice | null {
  const value = new URLSearchParams(search).get('notice');
  if (value === 'reset' || value === 'invite') {
    return value;
  }
  return null;
}

/** Lien qui conserve `lang` et retire `notice`, pour un nouvel onglet. */
export function hrefFor(pathname: string): string {
  const params = new URLSearchParams(window.location.search);
  params.delete('notice');
  const search = params.toString();
  return search.length === 0 ? pathname : `${pathname}?${search}`;
}

export function navigate(pathname: string, notice?: Notice): void {
  const params = new URLSearchParams(window.location.search);
  params.delete('notice');
  if (notice !== undefined) {
    params.set('notice', notice);
  }
  const search = params.toString();
  const next = search.length === 0 ? pathname : `${pathname}?${search}`;
  if (`${window.location.pathname}${window.location.search}` === next) {
    return;
  }
  window.history.pushState(null, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useAppLocation(): { route: AppRoute; notice: Notice | null } {
  const key = useSyncExternalStore(subscribe, locationKey, locationKey);
  const url = new URL(key, 'http://localhost');
  return {
    route: parsePathname(url.pathname),
    notice: readNotice(url.search),
  };
}

function locationKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('popstate', onStoreChange);
  return () => {
    window.removeEventListener('popstate', onStoreChange);
  };
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
