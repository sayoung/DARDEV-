import { cleanup, render, screen } from '@testing-library/react';
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
