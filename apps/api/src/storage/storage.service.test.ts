import {
  DeleteObjectCommand,
  type DeleteObjectCommandOutput,
  DeleteObjectsCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  ListObjectsV2Command,
  type HeadObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { beforeEach, afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { type Env } from '../config/env.js';
import { S3StorageService, LocalStorageService } from './storage.service.js';

describe('S3StorageService', () => {
  let s3: S3Client;
  let env: Env;
  let service: S3StorageService;
  let sendSpy: MockInstance;

  beforeEach(() => {
    s3 = new S3Client({
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
    sendSpy = vi.spyOn(s3, 'send').mockResolvedValue(undefined);

    env = {
      NODE_ENV: 'test',
      PORT: 3000,
      DATABASE_URL: 'postgres://',
      REDIS_URL: 'redis://',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'test',
      S3_SECRET_KEY: 'test',
      S3_BUCKET: 'test-bucket',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SESSION_SECRET: '12345678901234567890123456789012',
      ADMIN_BASE_URL: 'http://localhost:5173',
      STORAGE_PROVIDER: 's3',
      API_PUBLIC_URL: 'http://localhost:3000',
      MEDIA_PUBLIC_URL: 'http://localhost:9000/xplor',
      PUBLIC_WEB_URL: 'http://localhost:5174',
      API_CORS_ORIGINS: ['http://localhost:5173', 'http://localhost:5174'],
      API_TRUST_PROXY: false,
    };
    service = new S3StorageService(s3, env);
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate a presigned URL with the correct key and expiration', async () => {
      const url = await service.generatePresignedUploadUrl('test-key.jpg', 'image/jpeg', 1024);
      expect(url).toContain('test-bucket');
      expect(url).toContain('test-key.jpg');
      expect(url).toContain('X-Amz-Expires=900');
    });

    it('should use S3_PUBLIC_ENDPOINT when it differs from S3_ENDPOINT', async () => {
      const customEnv = { ...env, S3_ENDPOINT: 'http://minio:9000', S3_PUBLIC_ENDPOINT: 'https://media.xplor.ma' };
      const customService = new S3StorageService(s3, customEnv);
      const url = await customService.generatePresignedUploadUrl('test-key.jpg', 'image/jpeg', 1024);
      expect(url.startsWith('https://media.xplor.ma')).toBe(true);
    });

    it('should use S3_ENDPOINT when S3_PUBLIC_ENDPOINT falls back to it', async () => {
      // Use loadEnv to test the actual fallback
      const { loadEnv } = await import('../config/env.js');
      const customEnvSource = {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: 'postgres://',
        REDIS_URL: 'redis://',
        S3_ENDPOINT: 'http://minio:9000',
        S3_ACCESS_KEY: 'test',
        S3_SECRET_KEY: 'test',
        S3_BUCKET: 'test-bucket',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SESSION_SECRET: '12345678901234567890123456789012',
      };
      const customEnv = loadEnv(customEnvSource);
      const customService = new S3StorageService(s3, customEnv);
      const url = await customService.generatePresignedUploadUrl('test-key.jpg', 'image/jpeg', 1024);
      expect(url.startsWith('http://minio:9000')).toBe(true);
    });
  });

  describe('getSignedUrl', () => {
    it('should generate a presigned download URL', async () => {
      const url = await service.getSignedUrl('test-key.jpg', 3600);
      expect(url).toContain('test-bucket');
      expect(url).toContain('test-key.jpg');
      expect(url).toContain('X-Amz-Expires=3600');
    });

    it('should use S3_PUBLIC_ENDPOINT when it differs from S3_ENDPOINT', async () => {
      const customEnv = { ...env, S3_ENDPOINT: 'http://minio:9000', S3_PUBLIC_ENDPOINT: 'https://media.xplor.ma' };
      const customService = new S3StorageService(s3, customEnv);
      const url = await customService.getSignedUrl('test-key.jpg', 3600);
      expect(url.startsWith('https://media.xplor.ma')).toBe(true);
    });
  });

  describe('headObject', () => {
    it('should return size and contentType when object exists', async () => {
      const mockResponse: HeadObjectCommandOutput = {
        $metadata: {},
        ContentLength: 1024,
        ContentType: 'image/jpeg',
      };
      sendSpy.mockResolvedValueOnce(mockResponse);

      const result = await service.headObject('test-key.jpg');
      expect(sendSpy).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(result).toEqual({ sizeBytes: 1024, contentType: 'image/jpeg' });
    });

    it('should return null when object is not found', async () => {
      const error = new Error('Not found');
      error.name = 'NotFound';
      sendSpy.mockRejectedValueOnce(error);

      const result = await service.headObject('test-key.jpg');
      expect(result).toBeNull();
    });
    it('should return null when object is not found via httpStatusCode', async () => {
      const error = new Error('Some Error') as Error & { $metadata?: { httpStatusCode: number } };
      error.$metadata = { httpStatusCode: 404 };
      sendSpy.mockRejectedValueOnce(error);

      const result = await service.headObject('test-key.jpg');
      expect(result).toBeNull();
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('Unknown error');
      sendSpy.mockRejectedValueOnce(error);

      await expect(service.headObject('test-key.jpg')).rejects.toThrow('Unknown error');
    });
  });

  describe('deleteObject', () => {
    it('should send a DeleteObjectCommand', async () => {
      const mockResponse: DeleteObjectCommandOutput = { $metadata: {} };
      sendSpy.mockResolvedValueOnce(mockResponse);
      await service.deleteObject('test-key.jpg');
      expect(sendSpy).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });

  describe('getRange', () => {
    it('should request the specified byte range', async () => {
      const mockBody = { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };
      const mockResponse: GetObjectCommandOutput = { $metadata: {}, Body: mockBody as never };
      sendSpy.mockResolvedValueOnce(mockResponse);
      const result = await service.getRange('test-key.jpg', 0, 65535);
      expect(sendSpy).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw an error if response has no body', async () => {
      const mockResponse: GetObjectCommandOutput = { $metadata: {} };
      sendSpy.mockResolvedValueOnce(mockResponse);
      await expect(service.getRange('test-key.jpg', 0, 65535)).rejects.toThrow('No body in response');
    });
  });

  describe('deleteByPrefix', () => {
    it('should delete objects by prefix', async () => {
      sendSpy
        .mockResolvedValueOnce({
          Contents: [{ Key: 'test-prefix/1.jpg' }, { Key: 'test-prefix/2.jpg' }],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({ $metadata: {} });

      await service.deleteByPrefix('test-prefix/');

      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenNthCalledWith(1, expect.any(ListObjectsV2Command));
      expect(sendSpy).toHaveBeenNthCalledWith(2, expect.any(DeleteObjectsCommand));
    });

    it('should handle pagination', async () => {
      sendSpy
        .mockResolvedValueOnce({
          Contents: [{ Key: 'test-prefix/1.jpg' }],
          IsTruncated: true,
          NextContinuationToken: 'token1',
        })
        .mockResolvedValueOnce({ $metadata: {} })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'test-prefix/2.jpg' }],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({ $metadata: {} });

      await service.deleteByPrefix('test-prefix/');

      expect(sendSpy).toHaveBeenCalledTimes(4);
    });

    it('should do nothing if no objects found', async () => {
      sendSpy.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

      await service.deleteByPrefix('empty-prefix/');

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
    });
  });
});

describe('LocalStorageService', () => {
  let env: Env;
  let service: LocalStorageService;

  beforeEach(() => {
    env = {
      NODE_ENV: 'test',
      PORT: 3000,
      DATABASE_URL: 'postgres://',
      REDIS_URL: 'redis://',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'test',
      S3_SECRET_KEY: 'test',
      S3_BUCKET: 'test-bucket',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SESSION_SECRET: '12345678901234567890123456789012',
      ADMIN_BASE_URL: 'http://localhost:5173',
      STORAGE_PROVIDER: 'local',
      STORAGE_LOCAL_PATH: '/tmp/storage-test',
      API_PUBLIC_URL: 'http://localhost:3000',
      MEDIA_PUBLIC_URL: 'http://localhost:9000/xplor',
      PUBLIC_WEB_URL: 'http://localhost:5174',
      API_CORS_ORIGINS: ['http://localhost:5173', 'http://localhost:5174'],
      API_TRUST_PROXY: false,
    };
    service = new LocalStorageService(env);
  });

  it('should generate HMAC presigned upload URL', async () => {
    const url = await service.generatePresignedUploadUrl('test-key.jpg', 'image/jpeg', 1024);
    expect(url).toContain('http://localhost:3000/api/v1/storage/upload/');
  });

  it('should generate HMAC presigned download URL', async () => {
    const url = await service.getSignedUrl('test-key.jpg', 3600);
    expect(url).toContain('http://localhost:3000/api/v1/storage/download/');
  });

  it('headObject should return null on ENOENT', async () => {
    // Just pass a non-existent file path
    const result = await service.headObject('non-existent-file.jpg');
    expect(result).toBeNull();
  });

  it('should throw Error if path traversal is detected', async () => {
    await expect(service.headObject('../../../etc/passwd')).rejects.toThrow('Path traversal detected');
  });

  describe('deleteByPrefix', () => {
    let tmpDir: string;
    let fs: typeof import('fs/promises');
    let pathModule: typeof import('path');

    beforeEach(async () => {
      fs = await import('fs/promises');
      pathModule = await import('path');
      tmpDir = env.STORAGE_LOCAL_PATH ?? '/tmp/storage-test';
      await fs.mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should delete a directory and its contents', async () => {
      const dirPath = pathModule.join(tmpDir, 'test-prefix');
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(pathModule.join(dirPath, 'file1.txt'), 'test');
      await fs.writeFile(pathModule.join(dirPath, 'file2.txt'), 'test');

      await service.deleteByPrefix('test-prefix/');

      const exists = await fs.stat(dirPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should delete files matching a prefix', async () => {
      await fs.writeFile(pathModule.join(tmpDir, 'test-prefix-1.txt'), 'test');
      await fs.writeFile(pathModule.join(tmpDir, 'test-prefix-2.txt'), 'test');
      await fs.writeFile(pathModule.join(tmpDir, 'test-other.txt'), 'test');

      await service.deleteByPrefix('test-prefix-');

      const exists1 = await fs.stat(pathModule.join(tmpDir, 'test-prefix-1.txt')).then(() => true).catch(() => false);
      const existsOther = await fs.stat(pathModule.join(tmpDir, 'test-other.txt')).then(() => true).catch(() => false);

      expect(exists1).toBe(false);
      expect(existsOther).toBe(true);
    });

    it('should not throw if prefix does not exist', async () => {
      await expect(service.deleteByPrefix('non-existent')).resolves.not.toThrow();
    });
  });
});
