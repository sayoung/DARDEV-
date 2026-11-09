import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerHttpSecurity } from './http-security.js';

describe('http-security', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerHttpSecurity(app, ['https://admin.xplor.ma']);
    app.get('/ping', () => ({ status: 'ok' }));
    app.get('/html', (_, reply) => {
      return reply.type('text/html').send('<html><body><h1>Test</h1></body></html>');
    });
    await app.ready();
  });

  it('(1) inclut strict-transport-security avec max-age', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ping',
    });

    expect(response.statusCode).toBe(200);
    const hsts = response.headers['strict-transport-security'];
    expect(typeof hsts).toBe('string');
    if (typeof hsts !== 'string') {
      throw new Error('strict-transport-security must be a string');
    }
    expect(hsts).toContain('max-age=');
    expect(hsts).toBe('max-age=15552000; includeSubDomains');
  });

  it('(2) inclut content-security-policy stricte sans unsafe-inline (default-src \'none\' en API, plus strict que \'self\')', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ping',
    });

    expect(response.statusCode).toBe(200);
    const csp = response.headers['content-security-policy'];
    expect(typeof csp).toBe('string');
    if (typeof csp !== 'string') {
      throw new Error('content-security-policy must be a string');
    }
    // La configuration réelle de l'API définit default-src 'none', ce qui est plus strict que 'self'
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('(3) inclut x-content-type-options: nosniff', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ping',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('(4) une requête avec Origin: https://admin.xplor.ma reçoit access-control-allow-origin égal à cette origine', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: {
        origin: 'https://admin.xplor.ma',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://admin.xplor.ma');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('(5) une requête avec Origin: https://evil.example ne reçoit pas d\'access-control-allow-origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: {
        origin: 'https://evil.example',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('une route /html renvoyant text/html conserve default-src \'none\' et frame-ancestors \'none\' dans content-security-policy, et ne contient pas unsafe-inline', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/html',
    });

    expect(response.statusCode).toBe(200);
    const csp = response.headers['content-security-policy'];
    expect(typeof csp).toBe('string');
    if (typeof csp !== 'string') {
      throw new Error('content-security-policy must be a string');
    }
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-inline'");
  });
});

