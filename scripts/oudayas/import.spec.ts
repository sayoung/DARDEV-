import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { AssetKind, HotspotType, ProcessingStatus, z, HotspotCreateSchema } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { login, uploadFile, main, listTours, resolveReferences, ensureNoDuplicate, createTour, apiUrl } from './import.js';
import { buildTourPlan } from './plan.js';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    randomUUID: vi.fn(actual.randomUUID),
  };
});

function installMainFetch(mockFetch: MockedFunction<typeof fetch>, options: { assetStatus: string }) {
  let assetCounter = 0;
  mockFetch.mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || 'GET';

    if (url.includes('/api/v1/admin/tours') && method === 'GET') {
      return new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }), { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) });
    }
    if (url.includes('/api/v1/admin/cities') && method === 'GET') {
      return new Response(JSON.stringify([{ id: '00000000-0000-7000-8000-000000000008', name: { fr: 'Rabat', en: 'Rabat', ar: 'Rabat' }, region: 'x', lat: 0, lng: 0 }]), { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) });
    }
    if (url.includes('/api/v1/admin/categories') && method === 'GET') {
      return new Response(JSON.stringify([{ id: '00000000-0000-7000-8000-000000000009', name: { fr: 'Monument', en: 'Monument', ar: 'Monument' }, icon: 'x', color: '#000000', weight: 1 }]), { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) });
    }
    if (url.includes('/api/v1/auth/login') && method === 'POST') {
      const headers = new Headers();
      headers.append('Set-Cookie', 'sid=abc; Path=/');
      return new Response(JSON.stringify({ csrfToken: 'tok' }), { status: 200, headers });
    }
    if (url.includes('/api/v1/admin/assets/upload-url') && method === 'POST') {
      const body = JSON.parse(init?.body as string) as { filename: string };
      assetCounter++;
      const hex = assetCounter.toString(16).padStart(12, '0');
      const assetId = `00000000-0000-7000-8000-${hex}`;
      return new Response(
        JSON.stringify({
          assetId,
          uploadUrl: `http://s3.local/upload/${body.filename}`,
          uploadMethod: 'PUT',
          expiresInSeconds: 3600,
        }),
        { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) }
      );
    }
    if (method === 'PUT' && url.startsWith('http://s3.local/upload/')) {
      await new Promise((r) => setTimeout(r, 5));
      return new Response('', { status: 200 });
    }
    if (url.includes('/complete') && method === 'POST') {
      return new Response('', { status: 200 });
    }
    if (url.includes('/api/v1/admin/assets/') && method === 'GET') {
      const urlId = url.split('/').pop() || '';
      const id = urlId.length > 30 ? urlId : '00000000-0000-7000-8000-000000000000';
      return new Response(
        JSON.stringify({
          id,
          kind: AssetKind.PANORAMA,
          mimeType: 'image/jpeg',
          sizeBytes: 9,
          width: null,
          height: null,
          processingStatus: options.assetStatus,
          processingLog: null,
          copyright: null,
          thumbnailUrl: null,
          createdAt: new Date().toISOString(),
        }),
        { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) }
      );
    }
    if (url.includes('/api/v1/admin/tours') && method === 'POST') {
      const mockTour = { id: '00000000-0000-7000-8000-000000000012', title: { fr: 'T' }, summary: { fr: 'Sum' }, description: { fr: 'Desc' }, status: 'DRAFT', createdById: '00000000-0000-7000-8000-000000000001', categoryIds: ['00000000-0000-7000-8000-000000000009'], cityId: '00000000-0000-7000-8000-000000000008', coverAssetId: '00000000-0000-7000-8000-000000000010', publicShare: false, sceneCount: 1, contentVersion: 1, shareToken: 'tok-main', startSceneId: null, publishedAt: null };
      if (url.includes('/scenes/set-start')) return new Response(null, { status: 200 });
      if (url.includes('/publish')) return new Response(null, { status: 200 });
      if (url.includes('/share-token')) return new Response(JSON.stringify(mockTour), { status: 200 });
      if (url.includes('/scenes')) return new Response(JSON.stringify({ id: '00000000-0000-7000-8000-000000000013', tourId: '00000000-0000-7000-8000-000000000012', title: { fr: 'S' }, info: { fr: 'I' }, panoramaAssetId: '00000000-0000-7000-8000-000000000010', initialYaw: 0, initialPitch: 0, initialZoom: 50, weight: 1, hotspotCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }), { status: 201 });
      return new Response(JSON.stringify(mockTour), { status: 201 });
    }
    if (url.includes('/hotspots') && method === 'POST') {
      return new Response(null, { status: 201 });
    }

    return new Response('Not Found', { status: 404 });
  });
}

describe('Import Oudaïas (partie upload et authentification)', () => {
  let tmpDir: string;
  let mockFetch: MockedFunction<typeof fetch>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplor-import-test-'));
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('login() effectue un appel API et sauvegarde les jetons', async () => {
    const mockHeaders = new Headers();
    mockHeaders.append('Set-Cookie', 'sid=abc; Path=/');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ csrfToken: 'tok' }), {
        status: 200,
        headers: mockHeaders,
      })
    );

    await login('admin@test.local', 'password');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'admin@test.local', password: 'password' }),
      })
    );
  });

  it("uploadFile('a.jpg', dir) exécute la séquence complète avec les bons en-têtes", async () => {
    // 0. Simuler le login d'abord pour configurer les variables globales du module
    const mockHeaders = new Headers();
    mockHeaders.append('Set-Cookie', 'sid=abc; Path=/');
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ csrfToken: 'tok' }), {
        status: 200,
        headers: mockHeaders,
      })
    );

    await login('admin@test.local', 'password');
    mockFetch.mockClear();

    // Créer le fichier de test
    const fileName = 'a.jpg';
    fs.writeFileSync(path.join(tmpDir, fileName), 'fake-image-data');

    // 1. upload-url response
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          assetId: '018e6988-51f7-727c-9b65-6804aeb88941',
          uploadUrl: 'http://s3.local/upload-url',
          uploadMethod: 'PUT',
          expiresInSeconds: 3600,
        }),
        { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) }
      )
    );

    // 2. PUT response
    mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));

    // 3. complete response
    mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));

    const result = await uploadFile(fileName, tmpDir);

    // Vérifie que le retour est exactement ce qui est attendu
    expect(result).toEqual({ file: fileName, assetId: '018e6988-51f7-727c-9b65-6804aeb88941' });

    // Vérifie la séquence de 3 appels
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Vérifier l'appel 1 (upload-url POST)
    const call1 = mockFetch.mock.calls[0];
    if (!call1) throw new Error('Appel 1 manquant');
    expect(call1[0]).toBe('http://localhost:3000/api/v1/admin/assets/upload-url');
    const init1 = call1[1];
    if (!init1) throw new Error('Init 1 manquant');
    expect(init1.method).toBe('POST');
    const headers1 = new Headers(init1.headers);
    expect(headers1.get('Cookie')).toBe('sid=abc');
    expect(headers1.get('X-CSRF-Token')).toBe('tok');
    if (typeof init1.body !== 'string') throw new Error('Body 1 n\'est pas une chaîne');
    expect(JSON.parse(init1.body)).toEqual({
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 15,
      filename: fileName,
    });

    // Vérifier l'appel 2 (PUT vers S3)
    const call2 = mockFetch.mock.calls[1];
    if (!call2) throw new Error('Appel 2 manquant');
    expect(call2[0]).toBe('http://s3.local/upload-url');
    const init2 = call2[1];
    if (!init2) throw new Error('Init 2 manquant');
    expect(init2.method).toBe('PUT');
    const headers2 = new Headers(init2.headers);
    // PUT vers l'URL présignée ne porte ni Cookie ni X-CSRF-Token
    expect(headers2.has('Cookie')).toBe(false);
    expect(headers2.has('X-CSRF-Token')).toBe(false);
    expect(headers2.get('Content-Type')).toBe('image/jpeg');

    // Vérifier l'appel 3 (complete POST)
    const call3 = mockFetch.mock.calls[2];
    if (!call3) throw new Error('Appel 3 manquant');
    expect(call3[0]).toBe('http://localhost:3000/api/v1/admin/assets/018e6988-51f7-727c-9b65-6804aeb88941/complete');
    const init3 = call3[1];
    if (!init3) throw new Error('Init 3 manquant');
    expect(init3.method).toBe('POST');
    const headers3 = new Headers(init3.headers);
    expect(headers3.get('Cookie')).toBe('sid=abc');
    expect(headers3.get('X-CSRF-Token')).toBe('tok');
  });

  it('uploadFile échoue avec un statut HTTP non ok sur upload-url', async () => {
    const fileName = 'error.jpg';
    fs.writeFileSync(path.join(tmpDir, fileName), 'error-image-data');

    mockFetch.mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));

    await expect(uploadFile(fileName, tmpDir)).rejects.toThrowError(/upload-url échoué pour error\.jpg/);
  });

  it('main() respecte la limite de 3 envois simultanés', async () => {
    const dataPath = path.resolve('scripts/oudayas/tour-data.json');
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as { scenes: { file: string }[] };
    const files = rawData.scenes.map((s) => s.file);

    expect(files.length).toBeGreaterThan(3);

    for (const file of files) {
      fs.writeFileSync(path.join(tmpDir, file), 'fake-data');
    }

    let inFlightUploads = 0;
    let maxUploads = 0;

    installMainFetch(mockFetch, { assetStatus: ProcessingStatus.READY });
    const baseMock = mockFetch.getMockImplementation();
    if (!baseMock) throw new Error('Mock non défini');

    const callsOrder: string[] = [];
    mockFetch.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/v1/auth/login')) callsOrder.push('login');
      if (url.includes('/api/v1/admin/tours')) callsOrder.push('tours');
      if (url.includes('/api/v1/admin/assets/upload-url')) callsOrder.push('upload');

      const method = init?.method || 'GET';
      const isUpload = method === 'PUT' && url.startsWith('http://s3.local/upload/');
      
      if (isUpload) {
        inFlightUploads++;
        if (inFlightUploads > maxUploads) {
          maxUploads = inFlightUploads;
        }
      }

      const response = await baseMock(input, init);

      if (isUpload) {
        inFlightUploads--;
      }

      return response;
    });

    const env = {
      ...process.env,
      XPLOR_API_URL: 'http://localhost:3000',
      XPLOR_ADMIN_EMAIL: 'admin@test.local',
      XPLOR_ADMIN_PASSWORD: 'password',
      XPLOR_OUDAYAS_DIR: tmpDir,
    };

    await main(['node', 'import.ts'], env);

    expect(maxUploads).toBe(3);
    const firstTourIdx = callsOrder.indexOf('tours');
    const firstUploadIdx = callsOrder.indexOf('upload');
    expect(firstTourIdx).toBeLessThan(firstUploadIdx);
  });

  it('main() rejette avec erreur et n\'appelle pas upload-url si la visite existe déjà sans --replace', async () => {
    const dataPath = path.resolve('scripts/oudayas/tour-data.json');
    const rawData: unknown = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const parsedData = z.object({ title: z.string() }).parse(rawData);
    
    mockFetch.mockImplementation(async (input, init) => {
      await Promise.resolve();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      
      if (url.includes('/api/v1/auth/login') && method === 'POST') {
        const headers = new Headers();
        headers.append('Set-Cookie', 'sid=abc; Path=/');
        return new Response(JSON.stringify({ csrfToken: 'tok' }), { status: 200, headers });
      }
      
      if (url.includes('/api/v1/admin/tours') && method === 'GET') {
        const existingTour = {
          id: '00000000-0000-7000-8000-000000000001',
          title: { fr: parsedData.title, en: 'Tour', ar: 'جولة' },
          summary: { fr: 'Sum', en: 'Sum', ar: 'Sum' },
          description: { fr: 'Desc', en: 'Desc', ar: 'Desc' },
          status: 'DRAFT',
          createdById: '00000000-0000-7000-8000-000000000003',
          categoryIds: ['00000000-0000-7000-8000-000000000004'],
          cityId: '00000000-0000-7000-8000-000000000005',
          coverAssetId: '00000000-0000-7000-8000-000000000006',
          publicShare: true,
          shareToken: 'tok-1',
          sceneCount: 0,
          contentVersion: 1,
          startSceneId: '00000000-0000-7000-8000-000000000007',
          publishedAt: new Date().toISOString()
        };
        return new Response(JSON.stringify({ items: [existingTour], page: 1, pageSize: 20, total: 1 }), { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) });
      }

      return new Response('Not Found', { status: 404 });
    });

    const env = {
      ...process.env,
      XPLOR_API_URL: 'http://localhost:3000',
      XPLOR_ADMIN_EMAIL: 'admin@test.local',
      XPLOR_ADMIN_PASSWORD: 'password',
      XPLOR_OUDAYAS_DIR: tmpDir,
    };

    await expect(main(['node', 'import.ts'], env)).rejects.toThrowError(
      `[liste visites] La visite « ${parsedData.title} » existe déjà (id 00000000-0000-7000-8000-000000000001). Relancez avec --replace.`
    );
    
    // verify upload-url is never called
    const uploadUrlCalled = mockFetch.mock.calls.some(call => {
      const url = typeof call[0] === 'string' ? call[0] : call[0] instanceof URL ? call[0].toString() : call[0].url;
      return url.includes('/api/v1/admin/assets/upload-url');
    });
    expect(uploadUrlCalled).toBe(false);
  });
});

describe('Import Oudaïas (partie référentiels - listTours et resolveReferences)', () => {
  let mockFetch: MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listTours', () => {
    it('récupère la liste des visites paginée avec succès', async () => {
      // Page 1: 1 item, total 2
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: '00000000-0000-7000-8000-000000000001',
                title: { fr: 'Visite 1', en: 'Tour 1', ar: 'جولة 1' },
                summary: { fr: 'Sum', en: 'Sum', ar: 'Sum' },
                description: { fr: 'Desc', en: 'Desc', ar: 'Desc' },
                status: 'DRAFT',
                createdById: '00000000-0000-7000-8000-000000000003',
                categoryIds: ['00000000-0000-7000-8000-000000000004'],
                cityId: '00000000-0000-7000-8000-000000000005',
                coverAssetId: '00000000-0000-7000-8000-000000000006',
                publicShare: true,
                shareToken: 'tok-1',
                sceneCount: 0,
                contentVersion: 1,
                startSceneId: '00000000-0000-7000-8000-000000000007',
                publishedAt: new Date().toISOString(),
              }
            ],
            page: 1,
            pageSize: 1,
            total: 2
          }),
          { status: 200 }
        )
      );

      // Page 2: 1 item, total 2
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: '00000000-0000-7000-8000-000000000002',
                title: { fr: 'Visite 2', en: 'Tour 2', ar: 'جولة 2' },
                summary: { fr: 'Sum', en: 'Sum', ar: 'Sum' },
                description: { fr: 'Desc', en: 'Desc', ar: 'Desc' },
                status: 'DRAFT',
                createdById: '00000000-0000-7000-8000-000000000003',
                categoryIds: ['00000000-0000-7000-8000-000000000004'],
                cityId: '00000000-0000-7000-8000-000000000005',
                coverAssetId: '00000000-0000-7000-8000-000000000006',
                publicShare: true,
                shareToken: 'tok-2',
                sceneCount: 0,
                contentVersion: 1,
                startSceneId: '00000000-0000-7000-8000-000000000007',
                publishedAt: new Date().toISOString(),
              }
            ],
            page: 2,
            pageSize: 1,
            total: 2
          }),
          { status: 200 }
        )
      );

      const result = await listTours();
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('00000000-0000-7000-8000-000000000001');
      expect(result[1]?.id).toBe('00000000-0000-7000-8000-000000000002');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/v1/admin/tours?page=1');
      expect(mockFetch.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/v1/admin/tours?page=2');
    });

    it('gère une liste vide', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0
          }),
          { status: 200 }
        )
      );

      const result = await listTours();
      expect(result).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('lève une erreur préfixée si la réponse est en erreur', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

      await expect(listTours()).rejects.toThrowError(/\[liste visites\] Erreur HTTP 500/);
    });

    it('lève une erreur préfixée si le JSON est invalide', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{ invalid json', { status: 200 }));
      await expect(listTours()).rejects.toThrowError(/\[liste visites\] Réponse invalide :/);
    });
  });

  describe('resolveReferences', () => {
    const cityData = {
      id: '00000000-0000-7000-8000-000000000005',
      name: { fr: 'Rabat', en: 'Rabat', ar: 'الرباط' },
      region: 'Rabat-Salé-Kénitra',
      lat: 34.0208,
      lng: -6.8416,
    };
    
    const categoryData = {
      id: '00000000-0000-7000-8000-000000000004',
      name: { fr: 'Monument', en: 'Monument', ar: 'نصب' },
      icon: 'monument',
      color: '#000000',
      weight: 1,
    };

    it('résout cityId et categoryId avec succès', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify([cityData]), { status: 200 })) // Villes
        .mockResolvedValueOnce(new Response(JSON.stringify([categoryData]), { status: 200 })); // Catégories

      const result = await resolveReferences({ city: 'Rabat' });
      expect(result).toEqual({ cityId: '00000000-0000-7000-8000-000000000005', categoryId: '00000000-0000-7000-8000-000000000004' });
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/v1/admin/cities');
      expect(mockFetch.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/v1/admin/categories');
    });

    it('lève une erreur préfixée si la requête ville échoue', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

      await expect(resolveReferences({ city: 'Rabat' })).rejects.toThrowError(/\[référentiel\] Erreur HTTP 404 sur les villes/);
    });

    it('lève une erreur préfixée si la requête catégorie échoue', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify([cityData]), { status: 200 }))
        .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

      await expect(resolveReferences({ city: 'Rabat' })).rejects.toThrowError(/\[référentiel\] Erreur HTTP 403 sur les catégories/);
    });

    it('lève une erreur préfixée si la liste des villes est vide', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify([categoryData]), { status: 200 }));

      await expect(resolveReferences({ city: 'Rabat' })).rejects.toThrowError(/\[référentiel\] Aucune ville trouvée/);
    });

    it('lève une erreur préfixée si la liste des catégories est vide', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify([cityData]), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

      await expect(resolveReferences({ city: 'Rabat' })).rejects.toThrowError(/\[référentiel\] Aucune catégorie trouvée/);
    });

    it('lève une erreur préfixée si le JSON des villes est invalide', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{ invalid json', { status: 200 }));
      await expect(resolveReferences({ city: 'Rabat' })).rejects.toThrowError(/\[référentiel\] Réponse invalide \(villes\) :/);
    });

    it('lève une erreur préfixée si le JSON des catégories est invalide', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify([cityData]), { status: 200 }))
        .mockResolvedValueOnce(new Response('{ invalid json', { status: 200 }));
      await expect(resolveReferences({ city: 'Rabat' })).rejects.toThrowError(/\[référentiel\] Réponse invalide \(catégories\) :/);
    });
  });

  describe('ensureNoDuplicate', () => {
    const existingTour = {
      id: '00000000-0000-7000-8000-000000000001',
      title: { fr: 'Visite Test', en: 'Tour', ar: 'جولة' },
      summary: { fr: 'Sum', en: 'Sum', ar: 'Sum' },
      description: { fr: 'Desc', en: 'Desc', ar: 'Desc' },
      status: 'DRAFT',
      createdById: '00000000-0000-7000-8000-000000000003',
      categoryIds: ['00000000-0000-7000-8000-000000000004'],
      cityId: '00000000-0000-7000-8000-000000000005',
      coverAssetId: '00000000-0000-7000-8000-000000000006',
      publicShare: true,
      shareToken: 'tok-1',
      sceneCount: 0,
      contentVersion: 1,
      startSceneId: '00000000-0000-7000-8000-000000000007',
      publishedAt: new Date().toISOString()
    };

    it('réussit si la visite est absente', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }), { status: 200 })
      );
      await expect(ensureNoDuplicate('Nouvelle visite', false)).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('lève une erreur avec le message exact si la visite est présente et replace est faux', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [existingTour], page: 1, pageSize: 20, total: 1 }), { status: 200 })
      );
      await expect(ensureNoDuplicate('Visite Test', false)).rejects.toThrowError('[liste visites] La visite « Visite Test » existe déjà (id 00000000-0000-7000-8000-000000000001). Relancez avec --replace.');
    });

    it('lève une erreur préfixée [suppression] si res.ok est faux lors du DELETE', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ items: [existingTour], page: 1, pageSize: 20, total: 1 }), { status: 200 })
        )
        .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));
        
      await expect(ensureNoDuplicate('Visite Test', true)).rejects.toThrowError('[suppression] Échec de la suppression de la visite 00000000-0000-7000-8000-000000000001 (HTTP 500)');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1]?.[1]?.method).toBe('DELETE');
    });

    it('réussit avec un DELETE ok (200/204) si la visite est présente et replace est vrai', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ items: [existingTour], page: 1, pageSize: 20, total: 1 }), { status: 200 })
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      await expect(ensureNoDuplicate('Visite Test', true)).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/v1/admin/tours/00000000-0000-7000-8000-000000000001');
      expect(mockFetch.mock.calls[1]?.[1]?.method).toBe('DELETE');
    });
  });

  describe('createTour', () => {
    const mockData = {
      title: 'Tour',
      city: 'Rabat',
      description: 'Desc',
      scenes: [
        { file: 'a.jpg', name: 'Scène 1', info: 'Info 1' },
        { file: 'b.jpg', name: 'Scène 2', info: 'Info 2' },
      ],
    };

    const cityId = '00000000-0000-7000-8000-000000000008';
    const catId = '00000000-0000-7000-8000-000000000009';
    const assetId1 = '00000000-0000-7000-8000-0000000000a1';
    const assetId2 = '00000000-0000-7000-8000-0000000000b2';
    const assetIds = { 'a.jpg': assetId1, 'b.jpg': assetId2 };

    const tourId = '00000000-0000-7000-8000-000000000001';
    const realSceneId1 = '00000000-0000-7000-8000-000000000011';
    const realSceneId2 = '00000000-0000-7000-8000-000000000012';

    const mockTour = { id: tourId, title: { fr: 'T', en: 'T', ar: 'T' }, summary: { fr: 'Sum', en: 'Sum', ar: 'Sum' }, description: { fr: 'Desc', en: 'Desc', ar: 'Desc' }, status: 'DRAFT', createdById: '00000000-0000-7000-8000-000000000001', categoryIds: [catId], cityId, coverAssetId: assetId1, publicShare: false, sceneCount: 2, contentVersion: 1, shareToken: 'tok-xyz', startSceneId: null, publishedAt: null };

    const mockSceneResponse = (id: string, titleStr: string, infoStr: string, assetId: string, weight: number) => {
      return new Response(
        JSON.stringify({
          id,
          tourId,
          title: { fr: titleStr, en: titleStr, ar: titleStr },
          info: { fr: infoStr, en: infoStr, ar: infoStr },
          panoramaAssetId: assetId,
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 50,
          weight,
          hotspotCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        { status: 201 }
      );
    };

    it('crée une visite, ajoute des scènes et publie', async () => {
      vi.mocked(randomUUID)
        .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
        .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

      const planSceneId1 = 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa';
      const planSceneId2 = 'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb';

      const plan = buildTourPlan(mockData, assetIds, cityId, catId);
      const nbHotspots = plan.scenes.reduce((sum, scene) => sum + scene.hotspots.length, 0);
      expect(nbHotspots).toBeGreaterThanOrEqual(1);

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTour), { status: 201 }))
        .mockResolvedValueOnce(mockSceneResponse(realSceneId1, 'S1', 'I1', assetId1, 1))
        .mockResolvedValueOnce(mockSceneResponse(realSceneId2, 'S2', 'I2', assetId2, 2));

      for (let i = 0; i < nbHotspots; i++) {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 201 }));
      }

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTour), { status: 200 }));

      const token = await createTour(mockData, assetIds, cityId, catId);
      expect(token).toBe('tok-xyz');

      expect(mockFetch).toHaveBeenCalledTimes(1 + 2 + nbHotspots + 3);

      let callIndex = 0;

      expect(mockFetch.mock.calls[callIndex]?.[0]).toBe(`${apiUrl}/api/v1/admin/tours`);
      expect(mockFetch.mock.calls[callIndex]?.[1]?.method).toBe('POST');
      callIndex++;

      expect(mockFetch.mock.calls[callIndex]?.[0]).toBe(`${apiUrl}/api/v1/admin/tours/${tourId}/scenes`);
      expect(mockFetch.mock.calls[callIndex]?.[1]?.method).toBe('POST');
      callIndex++;

      expect(mockFetch.mock.calls[callIndex]?.[0]).toBe(`${apiUrl}/api/v1/admin/tours/${tourId}/scenes`);
      expect(mockFetch.mock.calls[callIndex]?.[1]?.method).toBe('POST');
      callIndex++;

      const expectedHotspotsCount = plan.scenes.map((s) => s.hotspots.length);
      expect(expectedHotspotsCount).toHaveLength(2);

      const hotspotCalls = [];
      let currentRealSceneId = realSceneId1;
      for (const count of expectedHotspotsCount) {
        for (let i = 0; i < count; i++) {
          expect(mockFetch.mock.calls[callIndex]?.[0]).toBe(`${apiUrl}/api/v1/admin/scenes/${currentRealSceneId}/hotspots`);
          expect(mockFetch.mock.calls[callIndex]?.[1]?.method).toBe('POST');
          hotspotCalls.push(mockFetch.mock.calls[callIndex]);
          callIndex++;
        }
        currentRealSceneId = realSceneId2;
      }
      
      expect(mockFetch.mock.calls[callIndex]?.[0]).toBe(`${apiUrl}/api/v1/admin/tours/${tourId}/scenes/set-start`);
      expect(mockFetch.mock.calls[callIndex]?.[1]?.method).toBe('POST');
      const setStartBodyStr = z.string().parse(mockFetch.mock.calls[callIndex]?.[1]?.body);
      const setStartBody = z.object({ sceneId: z.string() }).parse(JSON.parse(setStartBodyStr));
      expect(setStartBody).toEqual({ sceneId: realSceneId1 });
      callIndex++;

      expect(mockFetch.mock.calls[callIndex]?.[0]).toBe(`${apiUrl}/api/v1/admin/tours/${tourId}/publish`);
      expect(mockFetch.mock.calls[callIndex]?.[1]?.method).toBe('POST');
      callIndex++;

      expect(mockFetch.mock.calls[callIndex]?.[0]).toBe(`${apiUrl}/api/v1/admin/tours/${tourId}/share-token`);
      expect(mockFetch.mock.calls[callIndex]?.[1]?.method).toBe('POST');
      callIndex++;

      const expectedSceneLinkCount = plan.scenes.reduce((sum, scene) => sum + scene.hotspots.filter((h) => h.type === HotspotType.SCENE_LINK).length, 0);
      expect(expectedSceneLinkCount).toBeGreaterThanOrEqual(1);
      const sceneLinkBodies = hotspotCalls
        .map((call) => HotspotCreateSchema.parse(JSON.parse(z.string().parse(call?.[1]?.body))))
        .filter((body) => body.type === HotspotType.SCENE_LINK);

      expect(sceneLinkBodies).toHaveLength(expectedSceneLinkCount);
      for (const body of sceneLinkBodies) {
        expect(body.targetSceneId).toBeDefined();
        expect([realSceneId1, realSceneId2]).toContain(body.targetSceneId);
      }

      const allBodies = [
        ...hotspotCalls.map(c => z.string().parse(c?.[1]?.body)),
        setStartBodyStr
      ].join(' ');

      expect(allBodies).not.toContain(planSceneId1);
      expect(allBodies).not.toContain(planSceneId2);
      expect(allBodies).toContain(realSceneId1);
      expect(allBodies).toContain(realSceneId2);
    });

    it('échoue sur la création de la scène 2', async () => {
      vi.mocked(randomUUID)
        .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
        .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTour), { status: 201 }))
        .mockResolvedValueOnce(mockSceneResponse(realSceneId1, 'S1', 'I1', assetId1, 1))
        .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

      await expect(createTour(mockData, assetIds, cityId, catId)).rejects.toThrowError(/\[scène 2\//);
    });

    it('échoue lors de la publication', async () => {
      vi.mocked(randomUUID)
        .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
        .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

      const plan = buildTourPlan(mockData, assetIds, cityId, catId);
      const nbHotspots = plan.scenes.reduce((sum, scene) => sum + scene.hotspots.length, 0);

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTour), { status: 201 }))
        .mockResolvedValueOnce(mockSceneResponse(realSceneId1, 'S1', 'I1', assetId1, 1))
        .mockResolvedValueOnce(mockSceneResponse(realSceneId2, 'S2', 'I2', assetId2, 2));

      for (let i = 0; i < nbHotspots; i++) {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 201 }));
      }

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

      await expect(createTour(mockData, assetIds, cityId, catId)).rejects.toThrowError(/\[publication\]/);

      const publishCall = mockFetch.mock.calls.find((c) => c[0] === `${apiUrl}/api/v1/admin/tours/${tourId}/publish`);
      expect(publishCall).toBeDefined();

      const shareTokenCall = mockFetch.mock.calls.find((c) => c[0] === `${apiUrl}/api/v1/admin/tours/${tourId}/share-token`);
      expect(shareTokenCall).toBeUndefined();
    });

    it('échoue lors de la création de la visite', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

      await expect(createTour(mockData, assetIds, cityId, catId)).rejects.toThrowError(/\[création visite\]/);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('main() — scénarios import et dry-run', () => {
  let tmpDir: string;
  let mockFetch: MockedFunction<typeof fetch>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplor-import-dry-run-'));
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const writeSceneFiles = (dir: string, omit?: string) => {
    const dataPath = path.resolve('scripts/oudayas/tour-data.json');
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as { scenes: { file: string }[] };
    for (const scene of rawData.scenes) {
      if (scene.file !== omit) {
        fs.writeFileSync(path.join(dir, scene.file), 'fake-data');
      }
    }
  };

  it('tous les fichiers présents', async () => {
    writeSceneFiles(tmpDir);

    const env = {
      ...process.env,
      XPLOR_API_URL: 'http://localhost:3000',
      XPLOR_ADMIN_EMAIL: 'admin@test.local',
      XPLOR_ADMIN_PASSWORD: 'password',
    };

    await main(['node', 'import.ts', '--dry-run', '--dir', tmpDir], env);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();

    const logs = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logs).toContain('(OK)');
  });

  it('un fichier omis', async () => {
    const dataPath = path.resolve('scripts/oudayas/tour-data.json');
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as { scenes: { file: string }[] };
    const omitFile = rawData.scenes[0]?.file;

    writeSceneFiles(tmpDir, omitFile);

    const env = {
      ...process.env,
      XPLOR_API_URL: 'http://localhost:3000',
      XPLOR_ADMIN_EMAIL: 'admin@test.local',
      XPLOR_ADMIN_PASSWORD: 'password',
    };

    await main(['node', 'import.ts', '--dry-run', '--dir', tmpDir], env);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    const logs = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logs).toContain('MANQUANT');
  });
});
