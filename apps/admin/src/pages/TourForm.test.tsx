import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse, type TourResponse, TourStatus, TourUpdateSchema } from '@xplor/shared';
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

const profilePartner: MeResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9b',
  email: 'partner@xplor.test',
  name: 'Partner User',
  role: Role.PARTNER,
  uiLang: 'fr',
  csrfToken: 'csrf-partner',
};

const mockCities = [
  { id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c', name: { fr: 'Rabat' }, region: 'RSK', lat: 34, lng: -6 }
];

const mockCategories = [
  { id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9d', name: { fr: 'Musée' }, icon: 'museum', color: '#ff0000', weight: 1 }
];

const mockAssets = {
  items: [{
    id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e',
    kind: 'IMAGE',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    width: 800,
    height: 600,
    processingStatus: 'READY',
    processingLog: null,
    copyright: null,
    thumbnailUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z'
  }],
  total: 1, page: 1, pageSize: 20
};

const mockTour: TourResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f',
  title: { fr: 'Tour 1' },
  summary: { fr: 'Summary 1' },
  description: { fr: 'Desc 1' },
  cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c',
  categoryIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9d'],
  coverAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e',
  durationMinutes: 60,
  lat: 34.0,
  lng: -6.0,
  status: TourStatus.PUBLISHED,
  publicShare: false,
  shareToken: '1234567890123456789012',
  sceneCount: 2,
  createdById: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9a',
  contentVersion: 1,
  startSceneId: null,
  publishedAt: null,
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('TourForm Pages', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities') && method === 'GET') return Promise.resolve(jsonResponse(200, mockCities));
      if (url.includes('/admin/categories') && method === 'GET') return Promise.resolve(jsonResponse(200, mockCategories));
      if (url.includes('/admin/assets') && method === 'GET') return Promise.resolve(jsonResponse(200, mockAssets));
      if (url.includes('/admin/tours') && method === 'GET') return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
      
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('création envoie le bon corps puis navigue', async () => {
    window.history.replaceState(null, '', '/tours/new');
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities')) return Promise.resolve(jsonResponse(200, mockCities));
      if (url.includes('/admin/categories')) return Promise.resolve(jsonResponse(200, mockCategories));
      if (url.includes('/admin/assets')) return Promise.resolve(jsonResponse(200, mockAssets));
      if (url.includes('/admin/tours') && method === 'POST') {
        return Promise.resolve(jsonResponse(201, { ...mockTour, id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d90' }));
      }
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d90') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, { ...mockTour, id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d90' }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    
    await screen.findByText(/Musée/);
    
    const frTitleInput = screen.getAllByRole('textbox', { name: resources.fr.tour.form.title }).find((el) => el.getAttribute('lang') === 'fr');
    if (!frTitleInput) throw new Error('Input frTitleInput not found');
    fireEvent.change(frTitleInput, { target: { value: 'Nouveau tour' } });

    const frSummaryInput = screen.getAllByRole('textbox', { name: resources.fr.tour.form.summary }).find((el) => el.getAttribute('lang') === 'fr');
    if (!frSummaryInput) throw new Error('Input frSummaryInput not found');
    fireEvent.change(frSummaryInput, { target: { value: 'Un résumé court' } });

    fireEvent.change(screen.getByLabelText(resources.fr.tour.form.cityId), { target: { value: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c' } });
    fireEvent.click(screen.getByLabelText(/Musée/));
    fireEvent.change(screen.getByLabelText(resources.fr.tour.form.coverAssetId), { target: { value: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e' } });
    
    fireEvent.click(screen.getByRole('button', { name: resources.fr.common.save }));

    await waitFor(() => {
      const calls = recordedCalls();
      const postCall = calls.find((c) => c.method === 'POST' && c.url.includes('/admin/tours'));
      expect(postCall).toBeDefined();
      expect(postCall?.init?.body).toBe(JSON.stringify({
        title: { fr: 'Nouveau tour', ar: '', en: '' },
        summary: { fr: 'Un résumé court', ar: '', en: '' },
        cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c',
        categoryIds: ['018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9d'],
        coverAssetId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e',
      }));
      expect(window.location.pathname).toBe('/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d90');
    });
  });

  it('formulaire invalide (aucune catégorie) -> aucun POST', async () => {
    window.history.replaceState(null, '', '/tours/new');
    render(<App />);
    await screen.findByText(/Rabat/);

    const frTitleInput = screen.getAllByRole('textbox', { name: resources.fr.tour.form.title }).find((el) => el.getAttribute('lang') === 'fr');
    if (!frTitleInput) throw new Error('Input frTitleInput not found');
    fireEvent.change(frTitleInput, { target: { value: 'Nouveau tour' } });

    const frSummaryInput = screen.getAllByRole('textbox', { name: resources.fr.tour.form.summary }).find((el) => el.getAttribute('lang') === 'fr');
    if (!frSummaryInput) throw new Error('Input frSummaryInput not found');
    fireEvent.change(frSummaryInput, { target: { value: 'Un résumé court' } });

    fireEvent.change(screen.getByLabelText(resources.fr.tour.form.cityId), { target: { value: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9c' } });
    fireEvent.change(screen.getByLabelText(resources.fr.tour.form.coverAssetId), { target: { value: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e' } });

    fireEvent.click(screen.getByRole('button', { name: resources.fr.common.save }));

    await screen.findByText(resources.fr.catalog.errors.invalidForm);

    const postCall = recordedCalls().find((c) => c.method === 'POST');
    expect(postCall).toBeUndefined();
  });

  it('la modification préremplit puis envoie un PATCH', async () => {
    window.history.replaceState(null, '', '/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f');
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities')) return Promise.resolve(jsonResponse(200, mockCities));
      if (url.includes('/admin/categories')) return Promise.resolve(jsonResponse(200, mockCategories));
      if (url.includes('/admin/assets')) return Promise.resolve(jsonResponse(200, mockAssets));
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, mockTour));
      }
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'PATCH') {
        return Promise.resolve(jsonResponse(200, { ...mockTour, title: { fr: 'Titre Modifié' } }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    
    const titleInputs = await screen.findAllByDisplayValue('Tour 1');
    const titleInput = titleInputs.find((el) => !el.classList.contains('sr-only'));
    if (!titleInput) throw new Error('Title input not found');
    expect(titleInput).toBeTruthy();
    expect(screen.getAllByDisplayValue('60')[0]).toBeTruthy(); 
    expect(screen.getAllByDisplayValue('34')[0]).toBeTruthy(); 
    
    fireEvent.change(titleInput, { target: { value: 'Titre Modifié' } });
    fireEvent.click(screen.getByRole('button', { name: resources.fr.common.save }));

    await screen.findByText(resources.fr.tour.saveSuccess);

    const patchCall = recordedCalls().find((c) => c.method === 'PATCH' && c.url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f'));
    expect(patchCall).toBeDefined();
    const bodyText = typeof patchCall?.init?.body === 'string' ? patchCall.init.body : '';
    const bodyParsed: unknown = JSON.parse(bodyText);
    const body = TourUpdateSchema.parse(bodyParsed);
    expect(body.title.fr).toBe('Titre Modifié');
    expect(body.durationMinutes).toBe(60);
    expect(body.lat).toBe(34);
  });

  it('la suppression confirmée envoie DELETE et revient à /tours', async () => {
    window.history.replaceState(null, '', '/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities')) return Promise.resolve(jsonResponse(200, mockCities));
      if (url.includes('/admin/categories')) return Promise.resolve(jsonResponse(200, mockCategories));
      if (url.includes('/admin/assets')) return Promise.resolve(jsonResponse(200, mockAssets));
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, mockTour));
      }
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/admin/tours') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findAllByDisplayValue('Tour 1');

    fireEvent.click(screen.getByRole('button', { name: resources.fr.common.delete }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/tours');
    });

    const deleteCall = recordedCalls().find((c) => c.method === 'DELETE' && c.url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f'));
    expect(deleteCall).toBeDefined();
  });

  it('404 -> affiche un message', async () => {
    window.history.replaceState(null, '', '/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99');
    
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99')) return Promise.resolve(jsonResponse(404, { error: { code: 'TOUR_NOT_FOUND', message: 'Not found' } }));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    
    await screen.findByText(resources.fr.tour.notFound);
    const back = screen.getByRole('link', { name: resources.fr.tour.backToList });
    expect(back.getAttribute('href')).toBe('/tours');
  });

  it('un 422 à l’enregistrement garde le formulaire et affiche un message générique', async () => {
    window.history.replaceState(null, '', '/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f');

    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities')) return Promise.resolve(jsonResponse(200, mockCities));
      if (url.includes('/admin/categories')) return Promise.resolve(jsonResponse(200, mockCategories));
      if (url.includes('/admin/assets')) return Promise.resolve(jsonResponse(200, mockAssets));
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, mockTour));
      }
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'PATCH') {
        return Promise.resolve(jsonResponse(422, { error: { code: 'VALIDATION', message: 'invalid' } }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);

    const titleInputs = await screen.findAllByDisplayValue('Tour 1');
    const titleInput = titleInputs.find((el) => !el.classList.contains('sr-only'));
    if (!titleInput) throw new Error('Title input not found');
    fireEvent.change(titleInput, { target: { value: 'Titre Modifié' } });
    fireEvent.click(screen.getByRole('button', { name: resources.fr.common.save }));

    await screen.findByText(resources.fr.common.error.generic);
    const kept = screen.getAllByDisplayValue('Titre Modifié').find((el) => !el.classList.contains('sr-only'));
    expect(kept).toBeTruthy();
    expect(screen.getByRole('button', { name: resources.fr.common.save })).toBeTruthy();
    expect(window.location.pathname).toBe('/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f');
  });

  it('un échec de suppression garde le formulaire et affiche un message générique', async () => {
    window.history.replaceState(null, '', '/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities')) return Promise.resolve(jsonResponse(200, mockCities));
      if (url.includes('/admin/categories')) return Promise.resolve(jsonResponse(200, mockCategories));
      if (url.includes('/admin/assets')) return Promise.resolve(jsonResponse(200, mockAssets));
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, mockTour));
      }
      if (url.includes('/admin/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f') && method === 'DELETE') {
        return Promise.resolve(jsonResponse(500, { error: { code: 'INTERNAL', message: 'fail' } }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findAllByDisplayValue('Tour 1');
    fireEvent.click(screen.getByRole('button', { name: resources.fr.common.delete }));

    await screen.findByText(resources.fr.common.error.generic);
    expect(screen.getAllByDisplayValue('Tour 1').length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe('/tours/018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9f');

    const deleteCall = recordedCalls().find((c) => c.method === 'DELETE');
    expect(deleteCall).toBeDefined();
  });

  it('échec du chargement des villes ou des catégories affiche un message', async () => {
    window.history.replaceState(null, '', '/tours/new');

    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/cities') && method === 'GET') {
        return Promise.resolve(jsonResponse(500, { error: { code: 'INTERNAL', message: 'fail' } }));
      }
      if (url.includes('/admin/categories')) return Promise.resolve(jsonResponse(200, mockCategories));
      if (url.includes('/admin/assets')) return Promise.resolve(jsonResponse(200, mockAssets));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);

    await screen.findByText(resources.fr.catalog.errors.fetchFailed);
    expect(screen.getByRole('button', { name: resources.fr.common.save })).toBeTruthy();
  });

  it('accès refusé pour les autres rôles', async () => {
    window.history.replaceState(null, '', '/tours/new');
    
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profilePartner));
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    await screen.findByText(resources.fr.auth.accessDenied);
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
