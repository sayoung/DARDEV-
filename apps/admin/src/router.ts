import { useSyncExternalStore } from 'react';

export type Notice = 'reset' | 'invite';

export type AppRoute =
  | { name: 'home' }
  | { name: 'cities' }
  | { name: 'categories' }
  | { name: 'tours' }
  | { name: 'tour-new' }
  | { name: 'tour-detail'; id: string }
  | { name: 'scene-detail'; tourId: string; sceneId: string }
  | { name: 'hotspots'; tourId: string; sceneId: string }
  | { name: 'hotspot-new'; tourId: string; sceneId: string }
  | { name: 'hotspot-detail'; tourId: string; sceneId: string; id: string }
  | { name: 'media' }
  | { name: 'forgot' }
  | { name: 'reset'; token: string }
  | { name: 'invite'; token: string };

const RESET_PATH = /^\/reset\/([^/]+)$/;
const INVITE_PATH = /^\/invite\/([^/]+)$/;
const HOTSPOT_NEW_PATH = /^\/tours\/([^/]+)\/scenes\/([^/]+)\/hotspots\/new$/;
const HOTSPOT_DETAIL_PATH = /^\/tours\/([^/]+)\/scenes\/([^/]+)\/hotspots\/([^/]+)$/;
const HOTSPOTS_PATH = /^\/tours\/([^/]+)\/scenes\/([^/]+)\/hotspots$/;
const SCENE_DETAIL_PATH = /^\/tours\/([^/]+)\/scenes\/([^/]+)$/;
const TOUR_DETAIL_PATH = /^\/tours\/([^/]+)$/;

export function parsePathname(pathname: string): AppRoute {
  if (pathname === '/forgot') return { name: 'forgot' };
  if (pathname === '/cities') return { name: 'cities' };
  if (pathname === '/categories') return { name: 'categories' };
  if (pathname === '/tours') return { name: 'tours' };
  if (pathname === '/tours/new') return { name: 'tour-new' };
  if (pathname === '/media') return { name: 'media' };
  if (pathname === '/') return { name: 'home' };

  const resetToken = RESET_PATH.exec(pathname)?.[1];
  if (resetToken !== undefined) {
    return { name: 'reset', token: decodeSegment(resetToken) };
  }
  const inviteToken = INVITE_PATH.exec(pathname)?.[1];
  if (inviteToken !== undefined) {
    return { name: 'invite', token: decodeSegment(inviteToken) };
  }
  const hotspotNewMatch = HOTSPOT_NEW_PATH.exec(pathname);
  if (hotspotNewMatch !== null && hotspotNewMatch[1] !== undefined && hotspotNewMatch[2] !== undefined) {
    return { name: 'hotspot-new', tourId: decodeSegment(hotspotNewMatch[1]), sceneId: decodeSegment(hotspotNewMatch[2]) };
  }
  const hotspotDetailMatch = HOTSPOT_DETAIL_PATH.exec(pathname);
  if (hotspotDetailMatch !== null && hotspotDetailMatch[1] !== undefined && hotspotDetailMatch[2] !== undefined && hotspotDetailMatch[3] !== undefined) {
    return { name: 'hotspot-detail', tourId: decodeSegment(hotspotDetailMatch[1]), sceneId: decodeSegment(hotspotDetailMatch[2]), id: decodeSegment(hotspotDetailMatch[3]) };
  }
  const hotspotsMatch = HOTSPOTS_PATH.exec(pathname);
  if (hotspotsMatch !== null && hotspotsMatch[1] !== undefined && hotspotsMatch[2] !== undefined) {
    return { name: 'hotspots', tourId: decodeSegment(hotspotsMatch[1]), sceneId: decodeSegment(hotspotsMatch[2]) };
  }
  const sceneMatch = SCENE_DETAIL_PATH.exec(pathname);
  if (sceneMatch !== null && sceneMatch[1] !== undefined && sceneMatch[2] !== undefined) {
    return { name: 'scene-detail', tourId: decodeSegment(sceneMatch[1]), sceneId: decodeSegment(sceneMatch[2]) };
  }
  const tourId = TOUR_DETAIL_PATH.exec(pathname)?.[1];
  if (tourId !== undefined && tourId !== '') {
    return { name: 'tour-detail', id: decodeSegment(tourId) };
  }
  return { name: 'home' };
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
  navigateWithSearch(pathname, params.toString());
}

export function navigateWithSearch(pathname: string, search: string): void {
  const cleanSearch = search.startsWith('?') ? search.slice(1) : search;
  const next = cleanSearch.length === 0 ? pathname : `${pathname}?${cleanSearch}`;
  if (`${window.location.pathname}${window.location.search}` === next) {
    return;
  }
  window.history.pushState(null, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useAppLocation(): { route: AppRoute; notice: Notice | null; search: string } {
  const key = useSyncExternalStore(subscribe, locationKey, locationKey);
  const url = new URL(key, window.location.origin);
  return {
    route: parsePathname(url.pathname),
    notice: readNotice(url.search),
    search: url.search,
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
