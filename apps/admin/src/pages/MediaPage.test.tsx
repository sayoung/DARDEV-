import { cleanup, render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { AssetKind, ProcessingStatus, Role, type AssetResponse, type MeResponse, type PaginatedAssetResponse } from '@xplor/shared';
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

const mockReadyAsset: AssetResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d91',
  kind: AssetKind.PANORAMA,
  mimeType: 'image/jpeg',
  sizeBytes: 5242880, // 5.0 MB
  width: 8192,
  height: 4096,
  processingStatus: ProcessingStatus.READY,
  processingLog: null,
  copyright: null,
  thumbnailUrl: null,
  createdAt: '2026-10-01T12:00:00Z',
};

const mockErrorAsset: AssetResponse = {
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d92',
  kind: AssetKind.PANORAMA,
  mimeType: 'image/jpeg',
  sizeBytes: 1048576, // 1.0 MB
  width: null,
  height: null,
  processingStatus: ProcessingStatus.ERROR,
  processingLog: 'Image trop petite',
  copyright: null,
  thumbnailUrl: null,
  createdAt: '2026-10-02T14:30:00Z',
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

describe('MediaPage', () => {
  beforeEach(async () => {
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/media');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, profileAdmin));
      }
      if (url.includes('/admin/assets') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, {
          items: [mockReadyAsset, mockErrorAsset],
          total: 2,
          page: 1,
          pageSize: 20
        } satisfies PaginatedAssetResponse));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('affiche un état vide quand il n’y a aucun média', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/assets')) {
        return Promise.resolve(jsonResponse(200, {
          items: [],
          total: 0,
          page: 1,
          pageSize: 20
        } satisfies PaginatedAssetResponse));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    expect(await screen.findByText(resources.fr.media.empty)).toBeTruthy();
  });

  it('affiche une ligne READY et une ligne ERROR avec son journal', async () => {
    render(<App />);
    
    // Attendre le chargement
    await screen.findByText('8192 × 4096');
    
    // Vérifier les tailles (5.0 et 1.0)
    expect(screen.getByText('5.0')).toBeTruthy();
    expect(screen.getByText('1.0')).toBeTruthy();
    
    // Vérifier le statut READY
    expect(screen.getByText(resources.fr.media.status.READY)).toBeTruthy();
    
    // Vérifier le statut ERROR
    expect(screen.getByText(resources.fr.media.status.ERROR)).toBeTruthy();
    
    // Vérifier le log de l'erreur
    expect(screen.getByText('Image trop petite')).toBeTruthy();
  });

  it('reprocess met à jour le badge', async () => {
    render(<App />);
    await screen.findByText('8192 × 4096');

    // On mocke la réponse de reprocess
    fetchMock.mockImplementationOnce((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith('/reprocess') && methodOf(input, init) === 'POST') {
        return Promise.resolve(jsonResponse(200, {
          ...mockErrorAsset,
          processingStatus: ProcessingStatus.PENDING,
          processingLog: null,
        }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    const reprocessButtons = screen.getAllByRole('button', { name: resources.fr.media.actions.reprocess });
    expect(reprocessButtons.length).toBe(2);
    
    // On clique sur le bouton Retraiter de la ligne en erreur
    if (reprocessButtons[1]) fireEvent.click(reprocessButtons[1]);

    // On vérifie que le badge a été mis à jour
    expect(await screen.findByText(resources.fr.media.status.PENDING)).toBeTruthy();
  });

  it('delete confirmé recharge la liste', async () => {
    render(<App />);
    await screen.findByText('8192 × 4096');

    // On mocke la confirmation
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    // On mocke la réponse de delete
    fetchMock.mockImplementationOnce((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith(mockReadyAsset.id) && methodOf(input, init) === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    // On mocke la réponse de rechargement de la liste
    fetchMock.mockImplementationOnce((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      if (url.includes('/admin/assets') && methodOf(input, init) === 'GET') {
        return Promise.resolve(jsonResponse(200, {
          items: [mockErrorAsset], // on enlève l'asset supprimé
          total: 1,
          page: 1,
          pageSize: 20
        } satisfies PaginatedAssetResponse));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    const deleteButtons = screen.getAllByRole('button', { name: resources.fr.media.actions.delete });
    if (deleteButtons[0]) fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(resources.fr.media.actions.confirmDelete);
    
    // La liste se recharge et mockReadyAsset disparait
    await waitFor(() => {
      expect(screen.queryByText('8192 × 4096')).toBeNull();
    });
  });

  it('delete en 409 affiche l\'alerte', async () => {
    render(<App />);
    await screen.findByText('8192 × 4096');

    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    fetchMock.mockImplementationOnce((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      if (url.endsWith(mockReadyAsset.id) && methodOf(input, init) === 'DELETE') {
        return Promise.resolve(jsonResponse(409, { error: { code: 'CONFLICT' } }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    const deleteButtons = screen.getAllByRole('button', { name: resources.fr.media.actions.delete });
    if (deleteButtons[0]) fireEvent.click(deleteButtons[0]);

    // On vérifie l'alerte
    expect(await screen.findByText(resources.fr.media.errors.inUse)).toBeTruthy();
  });

  it('delete annulé n\'appelle pas l\'API', async () => {
    render(<App />);
    await screen.findByText('8192 × 4096');

    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => false);

    const deleteButtons = screen.getAllByRole('button', { name: resources.fr.media.actions.delete });
    if (deleteButtons[0]) fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    
    // Le fetch ne doit pas être appelé pour le DELETE
    // On peut vérifier en comptant le nombre d'appels à fetchMock (1 pour /me, 1 pour /assets)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rafraîchit toutes les 3s tant qu’un asset est en cours de traitement', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    const mockProcessingAsset = { ...mockReadyAsset, id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99', processingStatus: ProcessingStatus.PROCESSING };
    let listAssetsCount = 0;
    
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);
      
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, profileAdmin));
      if (url.includes('/admin/assets') && method === 'GET') {
        listAssetsCount++;
        if (listAssetsCount === 1) {
          return Promise.resolve(jsonResponse(200, {
            items: [mockProcessingAsset],
            total: 1,
            page: 1,
            pageSize: 20
          }));
        }
        return Promise.resolve(jsonResponse(200, {
          items: [{ ...mockReadyAsset, id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d99' }],
          total: 1,
          page: 1,
          pageSize: 20
        }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    render(<App />);
    
    // Premier rendu: PROCESSING
    expect(await screen.findByText(resources.fr.media.status.PROCESSING)).toBeTruthy();
    expect(listAssetsCount).toBe(1);

    // Avance de 3s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Deuxième rendu: READY
    expect(await screen.findByText(resources.fr.media.status.READY)).toBeTruthy();
    expect(listAssetsCount).toBe(2);

    // Avance de 10s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    // Aucun nouvel appel
    expect(listAssetsCount).toBe(2);
    
    vi.useRealTimers();
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
