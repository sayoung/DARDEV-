import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, TourStatus, type SelectionResponse, type TourResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../api/client.js';
import { getHotelSelection, saveHotelSelection } from '../api/hotels.js';
import { getTour, listCategories, listCities, listTours } from '../api/catalog.js';
import { App } from '../App.js';
import { i18n } from '../i18n.js';

vi.mock('../api/hotels.js', () => ({
  getHotelSelection: vi.fn(),
  saveHotelSelection: vi.fn(),
  listHotels: vi.fn(),
}));
vi.mock('../api/catalog.js', () => ({ getTour: vi.fn(), listCities: vi.fn(), listCategories: vi.fn(), listTours: vi.fn() }));

const hotelId = '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9e';
const tourAId = '018f6b21-4d39-7a1b-8e45-3f8c5b2a1d11';
const tourBId = '018f6b21-4d39-7a1b-8e45-3f8c5b2a1d12';
const tourCId = '018f6b21-4d39-7a1b-8e45-3f8c5b2a1d13';
const cityId = '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d10';
const categoryId = '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d20';
const selection: SelectionResponse = {
  hotelId,
  version: 4,
  featuredTourId: tourAId,
  attractTourIds: [tourBId],
  items: [{ tourId: tourAId, position: 0 }, { tourId: tourBId, position: 1 }],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('SelectionPage', () => {
  beforeEach(async () => {
    clearCsrfToken();
    window.history.replaceState(null, '', `/hotels/${hotelId}/selection?lang=fr`);
    await i18n.changeLanguage('fr');
    vi.mocked(getHotelSelection).mockReset().mockResolvedValue(selection);
    vi.mocked(saveHotelSelection).mockReset();
    vi.mocked(getTour).mockReset().mockImplementation((id) => Promise.resolve(makeTour(id, id === tourAId ? 'Visite A' : 'Visite B')));
    vi.mocked(listCities).mockReset().mockResolvedValue([{ id: cityId, name: { fr: 'Rabat' }, region: 'Rabat-Salé-Kénitra', lat: 34.02, lng: -6.84 }]);
    vi.mocked(listCategories).mockReset().mockResolvedValue([{ id: categoryId, name: { fr: 'Monuments' }, icon: 'landmark', color: '#6958A5', weight: 1 }]);
    vi.mocked(listTours).mockReset().mockResolvedValue({
      items: [makeTour(tourAId, 'Visite A'), makeTour(tourCId, 'Visite C')],
      page: 1, pageSize: 100, total: 2,
    });
    fetchMock.mockReset().mockResolvedValue(jsonResponse(200, {
      id: 'user-admin', email: 'admin@xplor.test', name: 'Admin User', role: Role.ADMIN,
      uiLang: 'fr', csrfToken: 'csrf-admin',
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('charge la sélection de la route, affiche les titres dans l’ordre et sa version', async () => {
    render(<App />);

    const orderedList = await screen.findByRole('list', { name: resources.fr.page.hotelSelection.selectedTours });
    expect(await within(orderedList).findByText('Visite A')).toBeTruthy();
    expect(within(orderedList).getByText('Visite B')).toBeTruthy();
    expect(within(orderedList).getAllByRole('listitem').map((item) => item.textContent.includes('Visite A')))
      .toEqual([true, false]);
    expect(screen.getByText(resources.fr.page.hotelSelection.version.replace('{{version}}', '4'))).toBeTruthy();
    expect(getHotelSelection).toHaveBeenCalledWith(hotelId);
    expect(getTour).toHaveBeenNthCalledWith(1, tourAId);
    expect(getTour).toHaveBeenNthCalledWith(2, tourBId);
  });

  it('déplace une visite et enregistre le brouillon', async () => {
    vi.mocked(saveHotelSelection).mockImplementation((_id, body) => Promise.resolve({
      ...selection,
      version: 5,
      featuredTourId: body.featuredTourId,
      attractTourIds: body.attractTourIds,
      items: body.tourIds.map((tourId, position) => ({ tourId, position })),
    }));
    render(<App />);
    await within(await screen.findByRole('list', { name: resources.fr.page.hotelSelection.selectedTours })).findByText('Visite B');

    screen.getByRole('button', { name: 'Monter Visite B' }).click();
    await waitFor(() => {
      const firstItem = within(screen.getByRole('list', { name: resources.fr.page.hotelSelection.selectedTours })).getAllByRole('listitem')[0];
      expect(firstItem?.textContent).toContain('Visite B');
    });
    screen.getByRole('button', { name: resources.fr.page.hotelSelection.save }).click();

    await waitFor(() => {
      expect(saveHotelSelection).toHaveBeenCalledWith(hotelId, {
        tourIds: [tourBId, tourAId], featuredTourId: tourAId, attractTourIds: [tourBId],
      });
    });
    expect(await screen.findByText(resources.fr.page.hotelSelection.saved)).toBeTruthy();
    expect(screen.getByText(resources.fr.page.hotelSelection.version.replace('{{version}}', '5'))).toBeTruthy();
  });

  it('affiche une erreur si l’enregistrement échoue', async () => {
    vi.mocked(saveHotelSelection).mockRejectedValue(new Error('offline'));
    render(<App />);
    await within(await screen.findByRole('list', { name: resources.fr.page.hotelSelection.selectedTours })).findByText('Visite A');

    screen.getByRole('button', { name: resources.fr.page.hotelSelection.save }).click();
    expect((await screen.findByRole('alert')).textContent).toContain(resources.fr.page.hotelSelection.error);
  });

  it('recherche dans le catalogue et demande uniquement les visites publiées', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'Ajouter' });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une visite' }), { target: { value: 'Kasbah' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => { expect(listTours).toHaveBeenLastCalledWith({ page: 1, pageSize: 100, status: TourStatus.PUBLISHED, q: 'Kasbah', cityId: undefined, categoryId: undefined }); });
  });

  it('filtre le catalogue par ville et catégorie', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'Ajouter' });

    fireEvent.change(screen.getByLabelText('Ville'), { target: { value: cityId } });
    await waitFor(() => { expect(listTours).toHaveBeenLastCalledWith({ page: 1, pageSize: 100, status: TourStatus.PUBLISHED, q: undefined, cityId, categoryId: undefined }); });
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: categoryId } });
    await waitFor(() => { expect(listTours).toHaveBeenLastCalledWith({ page: 1, pageSize: 100, status: TourStatus.PUBLISHED, q: undefined, cityId, categoryId }); });
  });

  it('ajoute une visite publiée et désactive Ajouter pour éviter les doublons', async () => {
    render(<App />);
    const addExisting = await screen.findByRole('button', { name: 'Ajoutée' });
    expect(addExisting.hasAttribute('disabled')).toBe(true);
    const addNew = screen.getByRole('button', { name: 'Ajouter' });
    fireEvent.click(addNew);

    await waitFor(() => { expect(screen.getAllByRole('button', { name: 'Ajoutée' })).toHaveLength(2); });
    expect(screen.getByRole('list', { name: resources.fr.page.hotelSelection.selectedTours }).textContent).toContain('Visite C');
    expect(screen.getAllByRole('button', { name: 'Ajoutée' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});

function makeTour(id: string, title: string): TourResponse {
  return { id, title: { fr: title }, summary: { fr: '' }, cityId: hotelId, categoryIds: [tourAId], coverAssetId: tourBId,
    status: TourStatus.PUBLISHED, publicShare: false, shareToken: 'share-token', sceneCount: 1, createdById: hotelId,
    contentVersion: 1, startSceneId: null, publishedAt: '2026-01-01T00:00:00.000Z' };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
