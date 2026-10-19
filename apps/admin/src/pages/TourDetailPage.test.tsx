import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse, type TourResponse, TourStatus } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';

const profileAdmin: MeResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9a',
  email: 'admin@xplor.test',
  name: 'Admin User',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-admin',
};

const mockTour: TourResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f',
  status: TourStatus.DRAFT,
  publicShare: false,
  shareToken: 'test-token',
  title: { fr: 'Tour 1' },
  summary: { fr: 'Res' },
  description: { fr: 'Desc' },
  practicalInfo: { fr: 'Prat' },
  cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c',
  categoryIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9d'],
  coverAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e',
  durationMinutes: 60,
  lat: 34,
  lng: -6,
  startSceneId: null,
  sceneCount: 0,
  createdById: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9a',
  contentVersion: 1,
  publishedAt: null,
};

describe('TourDetailPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn();
    window.fetch = fetchMock;
    clearCsrfToken();
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  function createMockOpenedWindow(): { window: Window; getHref: () => string; getOpener: () => unknown; closeMock: ReturnType<typeof vi.fn> } {
    let fakeHref = '';
    let fakeOpener: unknown = window;
    const closeMock = vi.fn();
    const proxy = new Proxy(window, {
      get(target, prop) {
        if (prop === 'location') {
          return {
            get href() {
              return fakeHref;
            },
            set href(val: string) {
              fakeHref = val;
            },
          };
        }
        if (prop === 'opener') {
          return fakeOpener;
        }
        if (prop === 'close') {
          return closeMock;
        }
        const val: unknown = Reflect.get(target, prop);
        return val;
      },
      set(target, prop, val: unknown) {
        if (prop === 'opener') {
          fakeOpener = val;
          return true;
        }
        return Reflect.set(target, prop, val);
      },
    });
    return {
      window: proxy,
      getHref: () => fakeHref,
      getOpener: () => fakeOpener,
      closeMock,
    };
  }

  function mockDefaultFetch(previewTokenStatus = 201) {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/admin/categories')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/admin/assets')) return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
      if (url.includes(`/admin/tours/${mockTour.id}/scenes`)) return Promise.resolve(jsonResponse(200, []));
      
      if (url.includes(`/admin/tours/${mockTour.id}/graph`)) {
        return Promise.resolve(jsonResponse(200, { nodes: [], edges: [] }));
      }
      if (url.includes(`/admin/tours/${mockTour.id}`) && !url.includes('scenes') && !url.includes('preview-token') && !url.includes('graph') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, mockTour));
      }
      if (url.includes(`/admin/tours/${mockTour.id}/preview-token`) && method === 'POST') {
        if (previewTokenStatus === 201) {
          return Promise.resolve(jsonResponse(201, { token: 'preview-token-123', expiresAt: Date.now() + 3600 }));
        }
        return Promise.resolve(jsonResponse(previewTokenStatus, { message: 'Preview token error' }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
  }

  it('clic sur Tester la visite ouvre window.open de façon synchrone puis assigne opener=null et location.href', async () => {
    window.history.replaceState(null, '', `/tours/${mockTour.id}`);

    const opened = createMockOpenedWindow();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(opened.window);

    mockDefaultFetch(201);

    render(<App />);

    const previewBtn = await screen.findByRole('button', { name: resources.fr.catalog.tours.preview.open });
    fireEvent.click(previewBtn);

    expect(openSpy).toHaveBeenCalledWith('', '_blank');

    await waitFor(() => {
      const posts = recordedCalls().filter(c => c.method === 'POST' && c.url.endsWith(`/admin/tours/${mockTour.id}/preview-token`));
      expect(posts).toHaveLength(1);
    });

    expect(opened.getOpener()).toBeNull();
    expect(opened.getHref()).toContain('/v/preview/preview-token-123?lang=fr');
  });

  it('si window.open renvoie null (bloqué), affiche un lien Ouvrir l\'aperçu cliquable vers l\'URL', async () => {
    window.history.replaceState(null, '', `/tours/${mockTour.id}`);

    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    mockDefaultFetch(201);

    render(<App />);

    const previewBtn = await screen.findByRole('button', { name: resources.fr.catalog.tours.preview.open });
    fireEvent.click(previewBtn);

    expect(openSpy).toHaveBeenCalledWith('', '_blank');

    await waitFor(() => {
      const posts = recordedCalls().filter(c => c.method === 'POST' && c.url.endsWith(`/admin/tours/${mockTour.id}/preview-token`));
      expect(posts).toHaveLength(1);
    });

    const fallbackLink = await screen.findByRole('link', { name: resources.fr.catalog.tours.preview.openLink });
    expect(fallbackLink.getAttribute('href')).toContain('/v/preview/preview-token-123?lang=fr');
    expect(fallbackLink.getAttribute('target')).toBe('_blank');
    expect(fallbackLink.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('si createPreviewToken échoue, ferme la fenêtre ouverte et affiche l\'erreur', async () => {
    window.history.replaceState(null, '', `/tours/${mockTour.id}`);

    const opened = createMockOpenedWindow();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(opened.window);

    mockDefaultFetch(500);

    render(<App />);

    const previewBtn = await screen.findByRole('button', { name: resources.fr.catalog.tours.preview.open });
    fireEvent.click(previewBtn);

    expect(openSpy).toHaveBeenCalledWith('', '_blank');

    await waitFor(() => {
      expect(opened.closeMock).toHaveBeenCalled();
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toBeDefined();
  });

  it('affiche le titre Carte des liens dans le panel TourLinkMap', async () => {
    window.history.replaceState(null, '', `/tours/${mockTour.id}`);

    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/admin/categories')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/admin/assets')) return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
      if (url.includes(`/admin/tours/${mockTour.id}/scenes`)) return Promise.resolve(jsonResponse(200, []));
      if (url.includes(`/admin/tours/${mockTour.id}/graph`)) return Promise.resolve(jsonResponse(200, { nodes: [], edges: [] }));
      
      if (url.includes(`/admin/tours/${mockTour.id}`) && !url.includes('scenes') && !url.includes('preview-token') && !url.includes('graph') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, mockTour));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);

    const title = await screen.findByText(resources.fr.catalog.tours.linkMap.title);
    expect(title).toBeDefined();
  });
  
  function isRequestInit(value: unknown): value is RequestInit {
    return typeof value === 'object' && value !== null;
  }

  function methodOf(input: unknown, init?: unknown): string {
    if (isRequestInit(init) && typeof init.method === 'string') return init.method.toUpperCase();
    if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
    return 'GET';
  }

  function requestUrl(input: unknown): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
    return '';
  }

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  type RecordedCall = {
    url: string;
    method: string;
    init: RequestInit | undefined;
  };

  function recordedCalls(): RecordedCall[] {
    return fetchMock.mock.calls.map((call) => {
      const init = isRequestInit(call[1]) ? call[1] : undefined;
      return {
        url: requestUrl(call[0]),
        method: (init?.method ?? methodOf(call[0], call[1])).toUpperCase(),
        init,
      };
    });
  }
});
