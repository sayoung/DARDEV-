import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { ENV } from '../config/config.module.js';
import { StorageController } from './storage.controller.js';
import { signStorageToken } from './storage.utils.js';

describe('StorageController', () => {
  let app: NestFastifyApplication;
  const localPath = path.join(process.cwd(), 'test_storage');

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: ENV,
          useValue: {
            STORAGE_PROVIDER: 'local',
            STORAGE_LOCAL_PATH: localPath,
            SESSION_SECRET: 'test-secret',
          },
        },
      ],
    }).compile();

    const fastifyAdapter = new FastifyAdapter({ maxParamLength: 1000 });
    fastifyAdapter.getInstance().addContentTypeParser('*', (req, payload, done) => {
      done(null, null);
    });

    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyAdapter);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
    await fs.promises.rm(localPath, { recursive: true, force: true });
  });

  it('devrait réussir avec un jeton valide', async () => {
    const key = 'test.txt';
    const expiresAt = Date.now() + 10000;
    const token = signStorageToken(key, expiresAt, 1000, 'test-secret');

    const result = await app.inject({
      method: 'PUT',
      url: `/storage/upload/${token}`,
      payload: 'hello world',
      headers: {
        'content-type': 'text/plain',
        'content-length': '11',
      },
    });

    expect(result.statusCode).toBe(200);
    const content = await fs.promises.readFile(path.join(localPath, key), 'utf8');
    expect(content).toBe('hello world');
  });

  it('devrait échouer si le jeton est expiré', async () => {
    const key = 'test.txt';
    const expiresAt = Date.now() - 10000;
    const token = signStorageToken(key, expiresAt, 1000, 'test-secret');

    const result = await app.inject({
      method: 'PUT',
      url: `/storage/upload/${token}`,
      payload: 'hello',
    });

    expect(result.statusCode).toBe(403);
    expect(result.json<{ message: string }>().message).toBe('Token expired');
  });

  it('devrait échouer avec une signature falsifiée', async () => {
    const token = 'ZmFrZS10b2tlbg=='; // base64 'fake-token'

    const result = await app.inject({
      method: 'PUT',
      url: `/storage/upload/${token}`,
      payload: 'hello',
    });

    expect(result.statusCode).toBe(400);
    expect(result.json<{ message: string }>().message).toBe('Invalid token');
  });

  it('devrait échouer si provider s3', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: ENV,
          useValue: {
            STORAGE_PROVIDER: 's3',
            STORAGE_LOCAL_PATH: localPath,
            SESSION_SECRET: 'test-secret',
          },
        },
      ],
    }).compile();

    const fastifyAdapterS3 = new FastifyAdapter({ maxParamLength: 1000 });
    fastifyAdapterS3.getInstance().addContentTypeParser('*', (req, payload, done) => {
      done(null, null);
    });
    const appS3 = moduleRef.createNestApplication<NestFastifyApplication>(fastifyAdapterS3);
    await appS3.init();
    await appS3.getHttpAdapter().getInstance().ready();

    const token = signStorageToken('key', Date.now() + 10000, 1000, 'test-secret');
    const result = await appS3.inject({
      method: 'PUT',
      url: `/storage/upload/${token}`,
      payload: 'hello',
    });

    expect(result.statusCode).toBe(400);
    expect(result.json<{ message: string }>().message).toBe('Not using local storage');

    await appS3.close();
  });
});
