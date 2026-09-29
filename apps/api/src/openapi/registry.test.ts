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

    const invitations = doc.paths?.['/api/v1/admin/users/invitations']?.post?.responses;
    expect(invitations?.['403']).toBeDefined();
    expect(invitations?.['409']).toBeDefined();

    expect(doc.paths?.['/api/v1/auth/logout']?.post?.security).toEqual([
      { sessionCookie: [], csrfToken: [] },
    ]);
    expect(doc.paths?.['/api/v1/auth/me']?.get?.security).toEqual([{ sessionCookie: [] }]);
  });

  it('est identique à docs/openapi.json', () => {
    const committed = readFileSync(openApiDocumentFile(), 'utf8');
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
