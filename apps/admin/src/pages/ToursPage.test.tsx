import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse, type TourResponse, type PaginatedTourResponse, type CityResponse, type CategoryResponse, TourStatus } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';

const profileAdmin: MeResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d90',
  email: 'admin@xplor.test',
  name: 'Admin User',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-admin',
};

const profilePartner: MeResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d91',
  email: 'partner@xplor.test',
  name: 'Partner User',
  role: Role.PARTNER,
  uiLang: 'fr',
  csrfToken: 'csrf-partner',
};

const mockCity: CityResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d92',
  name: { fr: 'Rabat', ar: 'الرباط', en: 'Rabat' },
  region: 'RSK',
  lat: 34.0,
  lng: -6.8,
};

const mockCategory: CategoryResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d93',
  name: { fr: 'Musée' },
  icon: 'museum',
  color: '#000000',
  weight: 0,
};

const mockTour: TourResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d94',
  title: { fr: 'Musée d\'Art' },
  summary: { fr: 'Un beau musée' },
  status: TourStatus.PUBLISHED,
  cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d92',
  categoryIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d93'],
  coverAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d95',
  sceneCount: 3,
  publicShare: false,
  shareToken: '1234567890123456789012',
  createdById: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d90',
  contentVersion: 1,
  startSceneId: null,
  publishedAt: null,
};

const mockDuplicateTour: TourResponse = {
  ...mockTour,
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d96',
  title: { fr: 'Musée d\'Art (copie)' },
  status: TourStatus.DRAFT,
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('ToursPage', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/tours');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    
    // Default mock implementation
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profileAdmin));
      }
      if (url.includes('/admin/tours') && !url.includes('/duplicate') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, {
          items: [mockTour],
          total: 15,
          page: 1,
          pageSize: 10
        } satisfies PaginatedTourResponse));
      }
      if (url.endsWith('/admin/cities') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [mockCity]));
      }
      if (url.endsWith('/admin/categories') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [mockCategory]));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('affiche la liste des visites', async () => {
    render(<App />);
    expect(await screen.findByText('Musée d\'Art')).toBeTruthy();
    expect(screen.getAllByText('Rabat').length).toBeGreaterThan(0);
    expect(screen.getAllByText(resources.fr.catalog.tour.status.PUBLISHED).length).toBeGreaterThan(0);
    expect(screen.getByText('3')).toBeTruthy(); // sceneCount
  });

  it('envoie status, cityId, categoryId et q dans l’URL fetch et la barre d’adresse', async () => {
    render(<App />);
    await screen.findByText('Musée d\'Art');

    const statusSelect = screen.getByRole('combobox', { name: resources.fr.catalog.tour.filters.status });
    fireEvent.change(statusSelect, { target: { value: 'DRAFT' } });

    await waitFor(() => {
      expect(lastToursGetUrl()).toContain('status=DRAFT');
    });
    expect(window.location.search).toContain('status=DRAFT');

    const citySelect = screen.getByRole('combobox', { name: resources.fr.catalog.tour.filters.city });
    fireEvent.change(citySelect, { target: { value: mockCity.id } });
    await waitFor(() => {
      expect(lastToursGetUrl()).toContain(`cityId=${mockCity.id}`);
    });
    expect(window.location.search).toContain(`cityId=${mockCity.id}`);

    const categorySelect = screen.getByRole('combobox', {
      name: resources.fr.catalog.tour.filters.category,
    });
    fireEvent.change(categorySelect, { target: { value: mockCategory.id } });
    await waitFor(() => {
      expect(lastToursGetUrl()).toContain(`categoryId=${mockCategory.id}`);
    });
    expect(window.location.search).toContain(`categoryId=${mockCategory.id}`);

    const searchInput = screen.getByRole('searchbox', { name: resources.fr.catalog.tour.filters.search });
    fireEvent.change(searchInput, { target: { value: 'Plage' } });
    const form = searchInput.closest('form');
    expect(form).toBeTruthy();
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(lastToursGetUrl()).toContain('q=Plage');
    });
    expect(window.location.search).toContain('q=Plage');
    expect(lastToursGetUrl()).toContain('status=DRAFT');
    expect(lastToursGetUrl()).toContain(`cityId=${mockCity.id}`);
    expect(lastToursGetUrl()).toContain(`categoryId=${mockCategory.id}`);

    const catalogGets = recordedCalls().filter(
      (call) =>
        call.method === 'GET' &&
        (call.url.endsWith('/admin/cities') || call.url.endsWith('/admin/categories')),
    );
    expect(catalogGets).toHaveLength(2);
  });

  it('revient à la page précédente depuis ?page=2', async () => {
    window.history.replaceState(null, '', '/tours?page=2');
    render(<App />);
    await screen.findByText('Musée d\'Art');
    expect(lastToursGetUrl()).toContain('page=2');

    const prevBtn = screen.getByRole('button', { name: resources.fr.catalog.tour.pagination.prev });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(window.location.search).toContain('page=1');
      expect(lastToursGetUrl()).toContain('page=1');
    });
  });

  it('ignore ?status=FOO&page=abc et les identifiants invalides', async () => {
    window.history.replaceState(null, '', '/tours?status=FOO&page=abc&cityId=invalid&categoryId=wrong');
    render(<App />);
    await screen.findByText('Musée d\'Art');

    const url = lastToursGetUrl();
    expect(url).toContain('page=1');
    expect(url).not.toContain('status=FOO');
    expect(url).not.toContain('cityId=invalid');
    expect(url).not.toContain('categoryId=wrong');
    const statusSelect = screen.getByRole('combobox', { name: resources.fr.catalog.tour.filters.status });
    expect(statusSelect instanceof HTMLSelectElement && statusSelect.value === '').toBe(true);
  });

  it('désactive Dupliquer pendant le POST puis ouvre la copie', async () => {
    let resolveDuplicate: (response: Response) => void = () => {};
    const duplicatePending = new Promise<Response>((resolve) => {
      resolveDuplicate = resolve;
    });

    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/tours') && !url.includes('/duplicate') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, { items: [mockTour], total: 1, page: 1, pageSize: 10 }));
      }
      if (url.endsWith('/admin/cities') && method === 'GET') return Promise.resolve(jsonResponse(200, []));
      if (url.endsWith('/admin/categories') && method === 'GET') return Promise.resolve(jsonResponse(200, []));

      if (url.endsWith(`/admin/tours/${mockTour.id}/duplicate`) && method === 'POST') {
        return duplicatePending;
      }

      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findByText('Musée d\'Art');

    const dupBtn = screen.getByRole('button', { name: resources.fr.catalog.tour.actions.duplicate });
    fireEvent.click(dupBtn);
    fireEvent.click(dupBtn);
    expect(dupBtn.hasAttribute('disabled')).toBe(true);

    const posts = recordedCalls().filter(
      (call) => call.url.endsWith(`/admin/tours/${mockTour.id}/duplicate`) && call.method === 'POST',
    );
    expect(posts).toHaveLength(1);

    resolveDuplicate(jsonResponse(201, mockDuplicateTour));
    await waitFor(() => {
      expect(window.location.pathname).toBe(`/tours/${mockDuplicateTour.id}`);
    });
  });

  it('masque Nouvelle visite pour PARTNER : GET /admin/tours répond 403', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profilePartner));
      if (url.includes('/admin/tours') && method === 'GET') {
        return Promise.resolve(
          jsonResponse(403, { statusCode: 403, message: 'Forbidden', error: 'Forbidden' }),
        );
      }
      if (url.endsWith('/admin/cities') && method === 'GET') return Promise.resolve(jsonResponse(200, []));
      if (url.endsWith('/admin/categories') && method === 'GET') return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain(resources.fr.catalog.errors.fetchFailed);
    expect(screen.queryByRole('button', { name: resources.fr.catalog.tour.actions.new })).toBeNull();
    expect(screen.queryByRole('button', { name: resources.fr.catalog.tour.actions.duplicate })).toBeNull();
  });
});

// Helpers
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

function lastToursGetUrl(): string | undefined {
  return [...recordedCalls()]
    .reverse()
    .find(
      (call) =>
        call.method === 'GET' && call.url.includes('/admin/tours') && !call.url.includes('/duplicate'),
    )?.url;
}
