import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerHttpSecurity } from './http-security.js';

describe('http-security', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerHttpSecurity(app, ['https://allowed.com']);
    app.get('/ping', () => ({ status: 'ok' }));
    app.get('/html', (_, reply) => {
      return reply.type('text/html').send('<html><body><h1>Test</h1></body></html>');
    });
    await app.ready();
  });

  it('should allow CORS for a permitted origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: {
        origin: 'https://allowed.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://allowed.com');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should not allow CORS for an unknown origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: {
        origin: 'https://unknown.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should set Helmet headers (HSTS and strict CSP)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ping',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['strict-transport-security']).toBe('max-age=15552000; includeSubDomains');
    
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('une route /html renvoyant text/html conserve default-src \'none\' et frame-ancestors \'none\' dans content-security-policy, et ne contient pas unsafe-inline', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/html',
    });

    expect(response.statusCode).toBe(200);
    const csp = response.headers['content-security-policy'] as string;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-inline'");
  });
});
