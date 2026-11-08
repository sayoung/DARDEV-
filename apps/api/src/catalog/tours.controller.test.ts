import 'reflect-metadata';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  Role,
  TourResponseSchema,
  TourStatus,
  type Principal,
  type TourResponse,
} from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { loadEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TourPublicationService } from './tour-publication.service.js';
import { ToursController } from './tours.controller.js';
import { ToursService } from './tours.service.js';

const ADMIN_USER_ID = '01990000-0000-7000-8000-000000000101';
const EDITOR_USER_ID = '01990000-0000-7000-8000-000000000102';
const HOTEL_MANAGER_USER_ID = '01990000-0000-7000-8000-000000000103';
const TOUR_ID = '01990000-0000-7000-8000-000000000010';
const CITY_ID = '01990000-0000-7000-8000-000000000001';
const CATEGORY_ID = '01990000-0000-7000-8000-000000000002';
const COVER_ASSET_ID = '01990000-0000-7000-8000-000000000003';
const START_SCENE_ID = '01990000-0000-7000-8000-000000000020';

const adminPrincipal: Principal = {
  userId: ADMIN_USER_ID,
  role: Role.ADMIN,
  hotelIds: [],
};

const editorPrincipal: Principal = {
  userId: EDITOR_USER_ID,
  role: Role.EDITOR,
  hotelIds: [],
};

const hotelManagerPrincipal: Principal = {
  userId: HOTEL_MANAGER_USER_ID,
  role: Role.HOTEL_MANAGER,
  hotelIds: [],
};

const samplePublishedResponse: TourResponse = TourResponseSchema.parse({
  id: TOUR_ID,
  title: { fr: 'Visite test' },
  summary: { fr: 'Résumé test' },
  cityId: CITY_ID,
  categoryIds: [CATEGORY_ID],
  coverAssetId: COVER_ASSET_ID,
  status: TourStatus.PUBLISHED,
  publicShare: false,
  shareToken: 'tok-share-12345678901',
  sceneCount: 1,
  createdById: ADMIN_USER_ID,
  contentVersion: 2,
  startSceneId: START_SCENE_ID,
  publishedAt: '2026-11-08T09:00:00.000Z',
});

const sampleDraftResponse: TourResponse = TourResponseSchema.parse({
  id: TOUR_ID,
  title: { fr: 'Visite test' },
  summary: { fr: 'Résumé test' },
  cityId: CITY_ID,
  categoryIds: [CATEGORY_ID],
  coverAssetId: COVER_ASSET_ID,
  status: TourStatus.DRAFT,
  publicShare: false,
  shareToken: 'tok-share-12345678901',
  sceneCount: 1,
  createdById: ADMIN_USER_ID,
  contentVersion: 3,
  startSceneId: START_SCENE_ID,
  publishedAt: '2026-11-08T09:00:00.000Z',
});

function makeSessionRequest(params?: {
  principal?: Principal;
  cookies?: Partial<Record<string, string | undefined>>;
  headers?: Partial<Record<string, string | string[] | undefined>>;
}): SessionRequest {
  return {
    method: 'POST',
    headers: params?.headers ?? {},
    cookies: params?.cookies,
    principal: params?.principal,
  };
}

class RecordingTourPublicationService extends TourPublicationService {
  public publishCalls: { id: string; actorId?: string }[] = [];
  public unpublishCalls: { id: string; actorId?: string }[] = [];
  public publishResult: TourResponse = samplePublishedResponse;
  public unpublishResult: TourResponse = sampleDraftResponse;

  constructor() {
    super(new PrismaService(), new ToursService(new PrismaService()));
  }

  override publish(id: string, actorId?: string): Promise<TourResponse> {
    this.publishCalls.push({ id, actorId });
    return Promise.resolve(this.publishResult);
  }

  override unpublish(id: string, actorId?: string): Promise<TourResponse> {
    this.unpublishCalls.push({ id, actorId });
    return Promise.resolve(this.unpublishResult);
  }
}

class RecordingToursService extends ToursService {
  readonly removeCalls: { id: string; actorId?: string }[] = [];

  constructor() {
    super(new PrismaService());
  }

  override remove(id: string, actorId?: string): Promise<void> {
    this.removeCalls.push({ id, actorId });
    return Promise.resolve();
  }
}

const testEnv = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://xplor:xplor@127.0.0.1:5432/xplor',
  REDIS_URL: 'redis://127.0.0.1:6379',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_ACCESS_KEY: 'xplor',
  S3_SECRET_KEY: 'xplor-dev-secret',
  S3_BUCKET: 'xplor',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SESSION_SECRET: 'dev-only-session-secret-not-for-production',
});

describe('ToursController', () => {
  let toursService: RecordingToursService;
  let publicationService: RecordingTourPublicationService;
  let controller: ToursController;

  beforeEach(() => {
    toursService = new RecordingToursService();
    publicationService = new RecordingTourPublicationService();
    controller = new ToursController(toursService, publicationService, testEnv);
  });

  describe('Métadonnées et gardes', () => {
    it('applique SessionGuard et CsrfGuard sur le contrôleur', () => {
      const guards: unknown = Reflect.getMetadata('__guards__', ToursController);
      expect(Array.isArray(guards)).toBe(true);
      if (Array.isArray(guards)) {
        expect(guards).toContain(SessionGuard);
        expect(guards).toContain(CsrfGuard);
      }
    });
  });

  describe('publish', () => {
    it('passe l id et le userId du principal ADMIN à publication.publish', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const result = await controller.publish(req, TOUR_ID);

      expect(result).toEqual(samplePublishedResponse);
      expect(publicationService.publishCalls).toEqual([
        { id: TOUR_ID, actorId: ADMIN_USER_ID },
      ]);
    });

    it('passe l id et le userId du principal EDITOR à publication.publish', async () => {
      const req = makeSessionRequest({ principal: editorPrincipal });
      const result = await controller.publish(req, TOUR_ID);

      expect(result).toEqual(samplePublishedResponse);
      expect(publicationService.publishCalls).toEqual([
        { id: TOUR_ID, actorId: EDITOR_USER_ID },
      ]);
    });

    it('refuse avec 403 ForbiddenException si le principal est absent', () => {
      const req = makeSessionRequest();
      expect(() => controller.publish(req, TOUR_ID)).toThrow(ForbiddenException);
      expect(publicationService.publishCalls).toHaveLength(0);
    });

    it('refuse avec 403 ForbiddenException si le rôle n est pas gestionnaire de contenu', () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });
      expect(() => controller.publish(req, TOUR_ID)).toThrow(ForbiddenException);
      expect(publicationService.publishCalls).toHaveLength(0);
    });

    it('refuse avec 400 BadRequestException si l id n est pas un identifiant valide', () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      expect(() => controller.publish(req, 'invalid-uuid')).toThrow(BadRequestException);
      expect(publicationService.publishCalls).toHaveLength(0);
    });
  });

  describe('unpublish', () => {
    it('passe l id et le userId du principal ADMIN à publication.unpublish', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const result = await controller.unpublish(req, TOUR_ID);

      expect(result).toEqual(sampleDraftResponse);
      expect(publicationService.unpublishCalls).toEqual([
        { id: TOUR_ID, actorId: ADMIN_USER_ID },
      ]);
    });

    it('passe l id et le userId du principal EDITOR à publication.unpublish', async () => {
      const req = makeSessionRequest({ principal: editorPrincipal });
      const result = await controller.unpublish(req, TOUR_ID);

      expect(result).toEqual(sampleDraftResponse);
      expect(publicationService.unpublishCalls).toEqual([
        { id: TOUR_ID, actorId: EDITOR_USER_ID },
      ]);
    });

    it('refuse avec 403 ForbiddenException si le principal est absent', () => {
      const req = makeSessionRequest();
      expect(() => controller.unpublish(req, TOUR_ID)).toThrow(ForbiddenException);
      expect(publicationService.unpublishCalls).toHaveLength(0);
    });

    it('refuse avec 403 ForbiddenException si le rôle n est pas gestionnaire de contenu', () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });
      expect(() => controller.unpublish(req, TOUR_ID)).toThrow(ForbiddenException);
      expect(publicationService.unpublishCalls).toHaveLength(0);
    });

    it('refuse avec 400 BadRequestException si l id n est pas un identifiant valide', () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      expect(() => controller.unpublish(req, 'invalid-uuid')).toThrow(BadRequestException);
      expect(publicationService.unpublishCalls).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('passe l id et le userId du principal ADMIN à tours.remove', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await controller.remove(req, TOUR_ID);

      expect(toursService.removeCalls).toEqual([
        { id: TOUR_ID, actorId: ADMIN_USER_ID },
      ]);
    });

    it('passe l id et le userId du principal EDITOR à tours.remove', async () => {
      const req = makeSessionRequest({ principal: editorPrincipal });
      await controller.remove(req, TOUR_ID);

      expect(toursService.removeCalls).toEqual([
        { id: TOUR_ID, actorId: EDITOR_USER_ID },
      ]);
    });

    it('refuse avec 403 ForbiddenException si le principal est absent', async () => {
      const req = makeSessionRequest();
      await expect(controller.remove(req, TOUR_ID)).rejects.toThrow(ForbiddenException);
      expect(toursService.removeCalls).toHaveLength(0);
    });

    it('refuse avec 403 ForbiddenException si le rôle n est pas gestionnaire de contenu', async () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });
      await expect(controller.remove(req, TOUR_ID)).rejects.toThrow(ForbiddenException);
      expect(toursService.removeCalls).toHaveLength(0);
    });

    it('refuse avec 400 BadRequestException si l id n est pas un identifiant valide', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.remove(req, 'invalid-uuid')).rejects.toThrow(BadRequestException);
      expect(toursService.removeCalls).toHaveLength(0);
    });
  });
});
