import { cleanup, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse, type PaginatedTourResponse, TourStatus, type TourResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';

const profileAdmin: MeResponse = {
  id: 'user-admin',
  email: 'admin@xplor.test',
  name: 'Admin User',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-admin',
};

const profilePartner: MeResponse = {
  id: 'user-partner',
  email: 'partner@xplor.test',
  name: 'Partner User',
  role: Role.PARTNER,
  uiLang: 'fr',
  csrfToken: 'csrf-partner',
};

const tour1: TourResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d01',
  title: { fr: 'T1' },
  summary: { fr: 'summary' },
  status: TourStatus.PUBLISHED,
  sceneCount: 2,
  createdById: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d02',
  cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d03',
  categoryIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d04'],
  coverAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d05',
  publicShare: false,
  shareToken: '1234567890123456789012',
  contentVersion: 1,
  startSceneId: null,
  publishedAt: null,
};

const tour2: TourResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d12',
  title: { fr: 'T2' },
  summary: { fr: 'summary' },
  status: TourStatus.DRAFT,
  sceneCount: 3,
  createdById: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d02',
  cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d03',
  categoryIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d04'],
  coverAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d05',
  publicShare: false,
  shareToken: '1234567890123456789013',
  contentVersion: 1,
  startSceneId: null,
  publishedAt: null,
};

const mockToursAll: PaginatedTourResponse = {
  items: [tour1, tour2],
  total: 5,
  page: 1,
  pageSize: 100
};

const mockToursDraft: PaginatedTourResponse = {
  items: [tour2],
  total: 2,
  page: 1,
  pageSize: 1
};

const mockToursPublished: PaginatedTourResponse = {
  items: [tour1],
  total: 3,
  page: 1,
  pageSize: 1
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('HomePage', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profileAdmin));
      }
      
      if (url.includes('/admin/tours')) {
        const urlObj = new URL(url, 'http://localhost');
        const status = urlObj.searchParams.get('status');
        if (status === TourStatus.DRAFT) {
          return Promise.resolve(jsonResponse(200, mockToursDraft));
        }
        if (status === TourStatus.PUBLISHED) {
          return Promise.resolve(jsonResponse(200, mockToursPublished));
        }
        return Promise.resolve(jsonResponse(200, mockToursAll));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('les 4 compteurs affichent les valeurs attendues', async () => {
    render(<App />);
    
    await screen.findAllByText('5');
    
    const countNodes = await screen.findAllByText(/^[235]$/);
    const textValues = countNodes.map(node => node.textContent);
    
    // total = 5, scenes = 5, drafts = 2, published = 3
    expect(textValues.filter(v => v === '5')).toHaveLength(2);
    expect(textValues).toContain('2');
    expect(textValues).toContain('3');
  });

  it('affiche une alerte en cas d\'erreur 500', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profileAdmin));
      }
      if (url.includes('/admin/tours')) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(resources.fr.page.home.error);
  });

  it('affiche le lien Nouvelle visite pour ADMIN mais pas pour PARTNER', async () => {
    render(<App />);
    expect(await screen.findByText(resources.fr.page.home.shortcuts.newTour)).toBeTruthy();
    cleanup();
    
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profilePartner));
      }
      if (url.includes('/admin/tours')) {
        return Promise.resolve(jsonResponse(200, mockToursAll));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findByText(resources.fr.page.home.shortcuts.manageTours);
    expect(screen.queryByText(resources.fr.page.home.shortcuts.newTour)).toBeNull();
  });
});

// Helpers
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
