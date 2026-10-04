import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';

export async function registerHttpSecurity(app: FastifyInstance, corsOrigins: string[]): Promise<void> {
  await app.register(fastifyCors, {
    origin: corsOrigins,
    credentials: true,
  });

  await app.register(fastifyHelmet, {
    hsts: {
      maxAge: 15552000,
      includeSubDomains: true,
    },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
      },
    },
  });
}
