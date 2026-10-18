import { readFileSync } from 'node:fs';

import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { OpenApiController } from './openapi.controller.js';
import { buildOpenApiDocument, openApiDocumentFile, serializeOpenApiDocument } from './registry.js';

const ROUTES = [
  { path: '/api/health', method: 'get' },
  { path: '/api/v1/auth/login', method: 'post' },
  { path: '/api/v1/auth/logout', method: 'post' },
  { path: '/api/v1/auth/me', method: 'get' },
  { path: '/api/v1/auth/password/forgot', method: 'post' },
  { path: '/api/v1/auth/password/reset', method: 'post' },
  { path: '/api/v1/auth/invite/accept', method: 'post' },
  { path: '/api/v1/admin/users/invitations', method: 'post' },
  { path: '/api/v1/admin/cities', method: 'get' },
  { path: '/api/v1/admin/cities', method: 'post' },
  { path: '/api/v1/admin/cities/{id}', method: 'get' },
  { path: '/api/v1/admin/cities/{id}', method: 'patch' },
  { path: '/api/v1/admin/cities/{id}', method: 'delete' },
  { path: '/api/v1/admin/hotels', method: 'get' },
  { path: '/api/v1/admin/hotels', method: 'post' },
  { path: '/api/v1/admin/hotels/{id}', method: 'get' },
  { path: '/api/v1/admin/hotels/{id}', method: 'patch' },
  { path: '/api/v1/admin/hotels/{id}', method: 'delete' },
  { path: '/api/v1/admin/kiosks', method: 'get' },
  { path: '/api/v1/admin/kiosks', method: 'post' },
  { path: '/api/v1/admin/kiosks/{id}', method: 'get' },
  { path: '/api/v1/admin/kiosks/{id}', method: 'patch' },
  { path: '/api/v1/admin/kiosks/{id}', method: 'delete' },
  { path: '/api/v1/admin/kiosks/{id}/enrollment-code', method: 'post' },
  { path: '/api/v1/admin/kiosks/{id}/disable', method: 'post' },
  { path: '/api/v1/admin/kiosks/{id}/force-sync', method: 'post' },
  { path: '/api/v1/kiosk/enroll', method: 'post' },
  { path: '/api/v1/kiosk/manifest', method: 'get' },
  { path: '/api/v1/kiosk/heartbeat', method: 'post' },
  { path: '/api/v1/kiosk/maintenance/verify-pin', method: 'post' },
  { path: '/api/v1/admin/hotels/{id}/managers', method: 'get' },
  { path: '/api/v1/admin/hotels/{id}/managers', method: 'put' },
  { path: '/api/v1/admin/hotels/{id}/selection', method: 'get' },
  { path: '/api/v1/admin/hotels/{id}/selection', method: 'put' },
  { path: '/api/v1/admin/categories', method: 'get' },
  { path: '/api/v1/admin/categories', method: 'post' },
  { path: '/api/v1/admin/categories/{id}', method: 'delete' },
  { path: '/api/v1/admin/assets', method: 'get' },
  { path: '/api/v1/admin/assets/{id}', method: 'get' },
  { path: '/api/v1/admin/tours', method: 'get' },
  { path: '/api/v1/admin/tours', method: 'post' },
  { path: '/api/v1/admin/tours/{id}', method: 'get' },
  { path: '/api/v1/admin/tours/{id}', method: 'patch' },
  { path: '/api/v1/admin/tours/{id}', method: 'delete' },
  { path: '/api/v1/admin/tours/{id}/validate', method: 'post' },
  { path: '/api/v1/admin/tours/{id}/publish', method: 'post' },
  { path: '/api/v1/admin/tours/{id}/unpublish', method: 'post' },
  { path: '/api/v1/admin/tours/{id}/duplicate', method: 'post' },
  { path: '/api/v1/admin/tours/{tourId}/scenes', method: 'get' },
  { path: '/api/v1/admin/tours/{tourId}/scenes', method: 'post' },
  { path: '/api/v1/admin/tours/{tourId}/scenes/reorder', method: 'post' },
  { path: '/api/v1/admin/tours/{tourId}/scenes/set-start', method: 'post' },
  { path: '/api/v1/admin/scenes/{id}', method: 'get' },
  { path: '/api/v1/admin/scenes/{id}', method: 'patch' },
  { path: '/api/v1/admin/scenes/{id}', method: 'delete' },
  { path: '/api/v1/admin/scenes/{sceneId}/hotspots', method: 'get' },
  { path: '/api/v1/admin/scenes/{sceneId}/hotspots', method: 'post' },
  { path: '/api/v1/admin/hotspots/{id}', method: 'patch' },
  { path: '/api/v1/admin/hotspots/{id}', method: 'delete' },
] as const;

describe('document OpenAPI', () => {
  it('est un OpenAPI 3.1 qui liste les routes du socle', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toMatch(/^3\.1\./);

    for (const route of ROUTES) {
      expect(doc.paths?.[route.path]?.[route.method]).toBeDefined();
    }

    const schemes = JSON.stringify(doc.components?.securitySchemes);
    expect(schemes).toContain('xplor_sid');
    expect(schemes).toContain('X-CSRF-Token');
    expect(schemes).toContain('kioskBearer');

    const body = JSON.stringify(doc);
    expect(body).toContain('INVALID_CREDENTIALS');
    expect(body).toContain('ACCOUNT_LOCKED');
    expect(body).toContain('TOKEN_INVALID');
    expect(body).toContain('EMAIL_TAKEN');
    expect(body).toContain('IN_USE');
    expect(body).toContain('CITY_NOT_FOUND');
    expect(body).toContain('PANORAMA_ASSET_NOT_FOUND');
    expect(body).toContain('SCENE_NOT_FOUND');

    const createTour = doc.paths?.['/api/v1/admin/tours']?.post?.responses;
    expect(createTour?.['422']).toBeDefined();
    expect(createTour?.['403']).toBeDefined();
    const listAssets = doc.paths?.['/api/v1/admin/assets']?.get?.responses;
    expect(listAssets?.['200']).toBeDefined();
    expect(listAssets?.['401']).toBeDefined();
    expect(listAssets?.['403']).toBeDefined();
    expect(doc.paths?.['/api/v1/admin/assets']?.post).toBeUndefined();
    const readAsset = doc.paths?.['/api/v1/admin/assets/{id}']?.get?.responses;
    expect(readAsset?.['200']).toBeDefined();
    expect(readAsset?.['404']).toBeDefined();
    expect(doc.paths?.['/api/v1/admin/assets/{id}']?.delete).toBeDefined();
    expect(body).toContain('ASSET_NOT_FOUND');
    const listTours = doc.paths?.['/api/v1/admin/tours']?.get?.responses;
    expect(listTours?.['403']).toBeDefined();
    const validateTour = doc.paths?.['/api/v1/admin/tours/{id}/validate']?.post?.responses;
    expect(validateTour?.['200']).toBeDefined();
    expect(validateTour?.['401']).toBeDefined();
    expect(validateTour?.['403']).toBeDefined();
    expect(validateTour?.['404']).toBeDefined();
    expect(body).toContain('SCENE_UNREACHABLE');
    const publishTour = doc.paths?.['/api/v1/admin/tours/{id}/publish']?.post?.responses;
    expect(publishTour?.['200']).toBeDefined();
    expect(publishTour?.['403']).toBeDefined();
    expect(publishTour?.['422']).toBeDefined();
    const unpublishTour = doc.paths?.['/api/v1/admin/tours/{id}/unpublish']?.post?.responses;
    expect(unpublishTour?.['200']).toBeDefined();
    expect(unpublishTour?.['404']).toBeDefined();
    const duplicateTour = doc.paths?.['/api/v1/admin/tours/{id}/duplicate']?.post?.responses;
    expect(duplicateTour?.['201']).toBeDefined();
    expect(duplicateTour?.['403']).toBeDefined();
    expect(duplicateTour?.['404']).toBeDefined();
    expect(body).toContain('TOUR_NOT_PUBLISHABLE');
    const createScene = doc.paths?.['/api/v1/admin/tours/{tourId}/scenes']?.post?.responses;
    expect(createScene?.['422']).toBeDefined();
    expect(createScene?.['404']).toBeDefined();
    const deleteScene = doc.paths?.['/api/v1/admin/scenes/{id}']?.delete?.responses;
    expect(deleteScene?.['204']).toBeDefined();
    expect(deleteScene?.['404']).toBeDefined();
    const reorder = doc.paths?.['/api/v1/admin/tours/{tourId}/scenes/reorder']?.post?.responses;
    expect(reorder?.['200']).toBeDefined();
    expect(reorder?.['422']).toBeDefined();
    const setStart = doc.paths?.['/api/v1/admin/tours/{tourId}/scenes/set-start']?.post?.responses;
    expect(setStart?.['200']).toBeDefined();
    expect(setStart?.['422']).toBeDefined();
    expect(body).toContain('SCENE_SET_MISMATCH');
    expect(body).toContain('START_SCENE_FOREIGN');
    expect(body).toContain('SCENE_LINK_TARGET_MISSING');
    expect(body).toContain('SCENE_LINK_SELF');
    expect(body).toContain('SCENE_LINK_FOREIGN');
    expect(body).toContain('TOUR_LINK_TARGET_MISSING');
    expect(body).toContain('TOUR_LINK_SELF');
    expect(body).toContain('TOUR_LINK_SCENE_FOREIGN');
    expect(body).toContain('MEDIA_ASSET_NOT_FOUND');
    const createHotspot = doc.paths?.['/api/v1/admin/scenes/{sceneId}/hotspots']?.post?.responses;
    expect(createHotspot?.['201']).toBeDefined();
    expect(createHotspot?.['422']).toBeDefined();
    expect(createHotspot?.['404']).toBeDefined();
    const listHotspots = doc.paths?.['/api/v1/admin/scenes/{sceneId}/hotspots']?.get?.responses;
    expect(listHotspots?.['200']).toBeDefined();
    expect(listHotspots?.['403']).toBeDefined();
    const updateHotspot = doc.paths?.['/api/v1/admin/hotspots/{id}']?.patch?.responses;
    expect(updateHotspot?.['200']).toBeDefined();
    expect(updateHotspot?.['422']).toBeDefined();
    expect(updateHotspot?.['404']).toBeDefined();
    const deleteHotspot = doc.paths?.['/api/v1/admin/hotspots/{id}']?.delete?.responses;
    expect(deleteHotspot?.['204']).toBeDefined();
    expect(deleteHotspot?.['404']).toBeDefined();
    expect(body).toContain('HOTSPOT_NOT_FOUND');

    const invitations = doc.paths?.['/api/v1/admin/users/invitations']?.post?.responses;
    expect(invitations?.['403']).toBeDefined();
    expect(invitations?.['409']).toBeDefined();

    expect(doc.paths?.['/api/v1/auth/logout']?.post?.security).toEqual([
      { sessionCookie: [], csrfToken: [] },
    ]);
    expect(doc.paths?.['/api/v1/auth/me']?.get?.security).toEqual([{ sessionCookie: [] }]);
  });

  it('documente le CRUD des hôtels et ses spécificités par rapport aux villes', () => {
    const doc = buildOpenApiDocument();

    const listHotels = doc.paths?.['/api/v1/admin/hotels']?.get?.responses;
    expect(listHotels?.['200']).toBeDefined();
    expect(listHotels?.['401']).toBeDefined();

    const createHotel = doc.paths?.['/api/v1/admin/hotels']?.post?.responses;
    expect(createHotel?.['201']).toBeDefined();
    expect(createHotel?.['400']).toBeDefined();
    expect(createHotel?.['401']).toBeDefined();
    expect(createHotel?.['403']).toBeDefined();
    expect(createHotel?.['422']).toBeDefined();

    const updateHotel = doc.paths?.['/api/v1/admin/hotels/{id}']?.patch?.responses;
    expect(updateHotel?.['200']).toBeDefined();
    expect(updateHotel?.['404']).toBeDefined();
    expect(updateHotel?.['422']).toBeDefined();
    expect(updateHotel?.['403']).toBeDefined();

    const deleteHotel = doc.paths?.['/api/v1/admin/hotels/{id}']?.delete?.responses;
    expect(deleteHotel?.['204']).toBeDefined();
    expect(deleteHotel?.['404']).toBeDefined();
    expect(deleteHotel?.['403']).toBeDefined();
    expect(deleteHotel?.['409']).toBeUndefined();

    expect(JSON.stringify(createHotel?.['403'])).toContain('rôle autre que ADMIN');

    const getManagers = doc.paths?.['/api/v1/admin/hotels/{id}/managers']?.get?.responses;
    expect(getManagers?.['200']).toBeDefined();
    expect(getManagers?.['401']).toBeDefined();
    expect(getManagers?.['404']).toBeDefined();
    expect(getManagers?.['400']).toBeUndefined();
    expect(JSON.stringify(getManagers?.['200'])).toContain('AccessPolicy');
    expect(JSON.stringify(getManagers?.['200'])).toContain('404 hors périmètre');

    const putManagers = doc.paths?.['/api/v1/admin/hotels/{id}/managers']?.put?.responses;
    expect(putManagers?.['200']).toBeDefined();
    expect(putManagers?.['400']).toBeDefined();
    expect(putManagers?.['401']).toBeDefined();
    expect(putManagers?.['403']).toBeDefined();
    expect(putManagers?.['404']).toBeDefined();
    expect(putManagers?.['422']).toBeDefined();
    expect(JSON.stringify(putManagers?.['403'])).toContain('Jeton CSRF refusé, ou rôle autre que ADMIN');

    const getSelection = doc.paths?.['/api/v1/admin/hotels/{id}/selection']?.get?.responses;
    expect(getSelection?.['200']).toBeDefined();
    expect(getSelection?.['401']).toBeDefined();
    expect(getSelection?.['404']).toBeDefined();
    expect(JSON.stringify(getSelection?.['200'])).toContain('AccessPolicy');
    expect(JSON.stringify(getSelection?.['200'])).toContain('404 hors périmètre');

    const putSelection = doc.paths?.['/api/v1/admin/hotels/{id}/selection']?.put?.responses;
    expect(putSelection?.['200']).toBeDefined();
    expect(putSelection?.['400']).toBeDefined();
    expect(putSelection?.['401']).toBeDefined();
    expect(putSelection?.['403']).toBeDefined();
    expect(putSelection?.['404']).toBeDefined();
    expect(putSelection?.['422']).toBeDefined();

    const createCity = doc.paths?.['/api/v1/admin/cities']?.post?.responses;
    const updateCity = doc.paths?.['/api/v1/admin/cities/{id}']?.patch?.responses;
    const deleteCity = doc.paths?.['/api/v1/admin/cities/{id}']?.delete?.responses;

    expect(createCity?.['422']).toBeUndefined();
    expect(updateCity?.['422']).toBeUndefined();
    expect(deleteCity?.['409']).toBeDefined();
  });

  it('documente le CRUD des kiosques et leur enrôlement public', () => {
    const doc = buildOpenApiDocument();
    const createKiosk = doc.paths?.['/api/v1/admin/kiosks']?.post;
    expect(createKiosk?.responses?.['201']).toBeDefined();
    expect(createKiosk?.responses?.['403']).toBeDefined();
    expect(createKiosk?.responses?.['422']).toBeDefined();
    const listKiosks = doc.paths?.['/api/v1/admin/kiosks']?.get;
    expect(listKiosks?.responses?.['200']).toBeDefined();
    expect(JSON.stringify(listKiosks?.responses?.['200'])).toContain('AccessPolicy');

    const updateKiosk = doc.paths?.['/api/v1/admin/kiosks/{id}']?.patch;
    expect(updateKiosk?.responses?.['200']).toBeDefined();
    expect(updateKiosk?.responses?.['403']).toBeDefined();
    expect(updateKiosk?.responses?.['404']).toBeDefined();
    const enrollmentCode = doc.paths?.['/api/v1/admin/kiosks/{id}/enrollment-code']?.post;
    expect(enrollmentCode?.responses?.['200']).toBeDefined();
    expect(enrollmentCode?.responses?.['403']).toBeDefined();
    const disable = doc.paths?.['/api/v1/admin/kiosks/{id}/disable']?.post;
    expect(disable?.responses?.['200']).toBeDefined();
    expect(disable?.responses?.['403']).toBeDefined();
    const forceSync = doc.paths?.['/api/v1/admin/kiosks/{id}/force-sync']?.post;
    expect(forceSync?.responses?.['204']).toBeDefined();
    expect(forceSync?.responses?.['400']).toBeDefined();
    expect(forceSync?.responses?.['403']).toBeDefined();
    expect(forceSync?.responses?.['404']).toBeDefined();

    const enroll = doc.paths?.['/api/v1/kiosk/enroll']?.post;
    expect(enroll?.responses?.['200']).toBeDefined();
    expect(enroll?.responses?.['401']).toBeDefined();
    expect(enroll?.responses?.['429']).toBeDefined();
    expect(enroll?.security).toBeUndefined();

    const manifest = doc.paths?.['/api/v1/kiosk/manifest']?.get;
    expect(manifest?.security).toEqual([{ kioskBearer: [] }]);
    expect(manifest?.responses?.['200']).toBeDefined();
    expect(JSON.stringify(manifest?.responses?.['200'])).toContain('manifestVersion');
    expect(JSON.stringify(manifest?.responses?.['200'])).toContain('maintenancePinHash');
    expect(manifest?.responses?.['401']).toBeDefined();
    expect(manifest?.responses?.['403']).toBeDefined();

    const heartbeat = doc.paths?.['/api/v1/kiosk/heartbeat']?.post;
    expect(heartbeat?.security).toEqual([{ kioskBearer: [] }]);
    expect(heartbeat?.requestBody).toBeDefined();
    expect(JSON.stringify(heartbeat?.requestBody)).toContain('syncedManifestVersion');
    expect(JSON.stringify(heartbeat?.requestBody)).toContain('recentErrors');
    expect(heartbeat?.responses?.['200']).toBeDefined();
    expect(JSON.stringify(heartbeat?.responses?.['200'])).toContain('forceSync');
    expect(JSON.stringify(heartbeat?.responses?.['200'])).toContain('serverTime');

    const verifyPin = doc.paths?.['/api/v1/kiosk/maintenance/verify-pin']?.post;
    expect(verifyPin?.security).toEqual([{ kioskBearer: [] }]);
    expect(verifyPin?.requestBody).toBeDefined();
    expect(JSON.stringify(verifyPin?.requestBody)).toContain('pin');
    expect(verifyPin?.responses?.['200']).toBeDefined();
    expect(JSON.stringify(verifyPin?.responses?.['200'])).toContain('valid');
    expect(verifyPin?.responses?.['400']).toBeDefined();
    expect(verifyPin?.responses?.['401']).toBeDefined();
    expect(verifyPin?.responses?.['403']).toBeDefined();
    expect(verifyPin?.responses?.['429']).toBeDefined();
  });

  it('est identique à docs/openapi.json', () => {
    const committed = readFileSync(openApiDocumentFile(), 'utf8').replace(/\r\n/g, '\n');
    expect(committed).toBe(serializeOpenApiDocument());
  });
});

describe('OpenApiController', () => {
  it('sert le document lorsque NODE_ENV n’est pas production', () => {
    const development = new OpenApiController({ NODE_ENV: 'development' });
    const test = new OpenApiController({ NODE_ENV: 'test' });

    expect(development.show().openapi).toMatch(/^3\.1\./);
    expect(test.show().openapi).toMatch(/^3\.1\./);
  });

  it('ne sert pas le document en production', () => {
    const controller = new OpenApiController({ NODE_ENV: 'production' });
    expect(() => controller.show()).toThrow(NotFoundException);
  });
});
