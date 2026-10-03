import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { TourGraph } from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicToursController } from './public-tours.controller.js';
import { ViewerService } from './viewer.service.js';

const GUARDS_METADATA = '__guards__';

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

  it('devrait être protégé par ThrottlerGuard', () => {
    const descriptor = Object.getOwnPropertyDescriptor(PublicToursController.prototype, 'get');
    if (!descriptor || typeof descriptor.value !== 'function') throw new Error('Method not found');
    expect(Reflect.getMetadata(GUARDS_METADATA, descriptor.value as object)).toEqual([ThrottlerGuard]);
  });

  it('devrait rejeter une langue invalide avec une 400', () => {
    expect(() => controller.get('validToken123', 'es')).toThrow(BadRequestException);
  });

  it('devrait appeler le service avec lang par défaut "fr" si lang est undefined', async () => {
    const mockGraph = { id: 'mock-graph' } as unknown as TourGraph;
    getPublicGraphMock.mockResolvedValue(mockGraph);

    const result = await controller.get('validToken123', undefined);

    expect(result).toBe(mockGraph);
    expect(getPublicGraphMock).toHaveBeenCalledWith('validToken123', 'fr');
  });

  it('devrait appeler le service avec la langue spécifiée', async () => {
    const mockGraph = { id: 'mock-graph' } as unknown as TourGraph;
    getPublicGraphMock.mockResolvedValue(mockGraph);

    const result = await controller.get('validToken123', 'ar');

    expect(result).toBe(mockGraph);
    expect(getPublicGraphMock).toHaveBeenCalledWith('validToken123', 'ar');
  });
});
