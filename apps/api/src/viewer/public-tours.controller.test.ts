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
