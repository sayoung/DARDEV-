import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { TourGraph } from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicToursController } from './public-tours.controller.js';
import { ViewerService } from './viewer.service.js';

const GUARDS_METADATA = '__guards__';
const HEADERS_METADATA = '__headers__';

describe('PublicToursController', () => {
  const getPublicGraphMock = vi.fn();
  let controller: PublicToursController;

  beforeEach(() => {
    vi.resetAllMocks();
    const viewerServiceMock = {
      getPublicGraph: getPublicGraphMock,
    } as unknown as ViewerService;
    controller = new PublicToursController(viewerServiceMock);
  });

  it('devrait rejeter un shareToken invalide avec une 404', () => {
    expect(() => controller.get('invalid@token', 'fr')).toThrow(NotFoundException);
    expect(() => controller.get('', 'fr')).toThrow(NotFoundException);
    expect(() => controller.get('a'.repeat(23), 'fr')).toThrow(NotFoundException);
  });

  it('devrait être protégé par ThrottlerGuard et Cache-Control', () => {
    const descriptor = Object.getOwnPropertyDescriptor(PublicToursController.prototype, 'get');
    const val: unknown = descriptor?.value;
    if (typeof val !== 'function') {
      throw new Error('Method not found');
    }
    const getMethod: object = val;

    expect(Reflect.getMetadata(GUARDS_METADATA, getMethod)).toEqual([ThrottlerGuard]);
    expect(Reflect.getMetadata(HEADERS_METADATA, getMethod)).toEqual([
      { name: 'Cache-Control', value: 'public, max-age=60' },
    ]);
  });

  it('devrait rejeter une langue invalide avec une 400', () => {
    expect(() => controller.get('validToken123', 'es')).toThrow(BadRequestException);
  });

  it('devrait appeler le service avec lang par défaut "fr" si lang est undefined', async () => {
    const mockGraph: Partial<TourGraph> = { id: 'mock-graph' };
    getPublicGraphMock.mockResolvedValue(mockGraph);

    const result = await controller.get('validToken123', undefined);

    expect(result).toBe(mockGraph);
    expect(getPublicGraphMock).toHaveBeenCalledWith('validToken123', 'fr');
  });

  it('devrait appeler le service avec la langue spécifiée', async () => {
    const mockGraph: Partial<TourGraph> = { id: 'mock-graph' };
    getPublicGraphMock.mockResolvedValue(mockGraph);

    const result = await controller.get('validToken123', 'ar');

    expect(result).toBe(mockGraph);
    expect(getPublicGraphMock).toHaveBeenCalledWith('validToken123', 'ar');
  });
});

describe('PublicShareController', () => {
  const getShareMetaMock = vi.fn();
  let controller: import('./public-tours.controller.js').PublicShareController;

  beforeEach(async () => {
    vi.resetAllMocks();
    const viewerServiceMock = {
      getShareMeta: getShareMetaMock,
    } as unknown as ViewerService;
    const { PublicShareController } = await import('./public-tours.controller.js');
    controller = new PublicShareController(viewerServiceMock, { PUBLIC_WEB_URL: 'http://example.com' });
  });

  it('devrait retourner du HTML 200 contenant og:title', async () => {
    getShareMetaMock.mockResolvedValue({
      title: 'Titre de la visite',
      summary: 'Résumé',
      coverUrl: null,
    });

    const result = await controller.get('validToken123', 'fr');

    expect(getShareMetaMock).toHaveBeenCalledWith('validToken123', 'fr');
    expect(result).toContain('<meta property="og:title" content="Titre de la visite">');
    expect(result).toContain('<html lang="fr" dir="ltr">');
    expect(result).toContain('http://example.com/share/validToken123?lang=fr');
    expect(result).toContain('http://example.com/v/validToken123?lang=fr');
  });

  it('devrait rejeter un shareToken invalide avec une 404', async () => {
    await expect(controller.get('invalid@token', 'fr')).rejects.toThrow(NotFoundException);
    await expect(controller.get('', 'fr')).rejects.toThrow(NotFoundException);
  });

  it('devrait rejeter une langue invalide avec une 400', async () => {
    await expect(controller.get('validToken123', 'es')).rejects.toThrow(BadRequestException);
  });
});

describe('PublicPreviewController', () => {
  const getPreviewGraphMock = vi.fn();
  let controller: import('./public-tours.controller.js').PublicPreviewController;
  
  beforeEach(async () => {
    vi.resetAllMocks();
    const viewerServiceMock = {
      getPreviewGraph: getPreviewGraphMock,
    } as unknown as ViewerService;
    const { PublicPreviewController } = await import('./public-tours.controller.js');
    controller = new PublicPreviewController(viewerServiceMock, { SESSION_SECRET: 'test-secret' });
  });

  it('devrait rejeter un jeton invalide avec une 404', async () => {
    await expect(controller.get('invalid-token', 'fr')).rejects.toThrow(NotFoundException);
  });

  it('devrait rejeter une langue invalide avec une 400', async () => {
    const { signPreviewToken } = await import('../catalog/preview-token.js');
    const validToken = signPreviewToken('tour-id', 'test-secret', Date.now()).token;
    await expect(controller.get(validToken, 'es')).rejects.toThrow(BadRequestException);
  });

  it('devrait retourner le graphe pour un jeton valide', async () => {
    const { signPreviewToken } = await import('../catalog/preview-token.js');
    const validToken = signPreviewToken('tour-123', 'test-secret', Date.now()).token;
    const mockGraph: Partial<TourGraph> = { id: 'preview-graph' };
    getPreviewGraphMock.mockResolvedValue(mockGraph);

    const result = await controller.get(validToken, 'fr');
    expect(result).toBe(mockGraph);
    expect(getPreviewGraphMock).toHaveBeenCalledWith('tour-123', 'fr');
  });

  it('devrait être protégé par ThrottlerGuard et Cache-Control no-store', async () => {
    const { PublicPreviewController } = await import('./public-tours.controller.js');
    const descriptor = Object.getOwnPropertyDescriptor(PublicPreviewController.prototype, 'get');
    const val: unknown = descriptor?.value;
    if (typeof val !== 'function') throw new Error('Method not found');
    const getMethod: object = val;

    expect(Reflect.getMetadata(GUARDS_METADATA, getMethod)).toEqual([ThrottlerGuard]);
    expect(Reflect.getMetadata(HEADERS_METADATA, getMethod)).toEqual([
      { name: 'Cache-Control', value: 'no-store' },
    ]);
  });
});

