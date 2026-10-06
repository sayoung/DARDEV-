import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AssetKind } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { login, uploadFile } from './import.js';

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
});
