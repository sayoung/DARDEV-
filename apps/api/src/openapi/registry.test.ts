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
  { path: '/api/v1/admin/categories', method: 'get' },
  { path: '/api/v1/admin/categories', method: 'post' },
  { path: '/api/v1/admin/categories/{id}', method: 'delete' },
  { path: '/api/v1/admin/tours', method: 'get' },
  { path: '/api/v1/admin/tours', method: 'post' },
  { path: '/api/v1/admin/tours/{id}', method: 'get' },
  { path: '/api/v1/admin/tours/{id}', method: 'patch' },
  { path: '/api/v1/admin/tours/{id}', method: 'delete' },
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
    const listTours = doc.paths?.['/api/v1/admin/tours']?.get?.responses;
    expect(listTours?.['403']).toBeDefined();
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
