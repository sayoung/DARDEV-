import {
  DeleteObjectCommand,
  type DeleteObjectCommandOutput,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

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
      S3_ACCESS_KEY: 'test',
      S3_SECRET_KEY: 'test',
      S3_BUCKET: 'test-bucket',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SESSION_SECRET: '12345678901234567890123456789012',
      ADMIN_BASE_URL: 'http://localhost:5173',
      STORAGE_PROVIDER: 's3',
    };
    service = new S3StorageService(s3, env);
  });

  describe('generatePresignedUploadUrl (and presignPut)', () => {
    it('should generate a presigned URL with the correct key and expiration', async () => {
      const url = await service.generatePresignedUploadUrl('test-key.jpg', 'image/jpeg', 1024);
      expect(url).toContain('test-bucket');
      expect(url).toContain('test-key.jpg');
      expect(url).toContain('X-Amz-Expires=900');
    });
  });

  describe('getSignedUrl', () => {
    it('should generate a presigned download URL', async () => {
      const url = await service.getSignedUrl('test-key.jpg', 3600);
      expect(url).toContain('test-bucket');
      expect(url).toContain('test-key.jpg');
      expect(url).toContain('X-Amz-Expires=3600');
    });
  });

  describe('headObject (and head)', () => {
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
  });

  describe('deleteObject (and delete)', () => {
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
      S3_ACCESS_KEY: 'test',
      S3_SECRET_KEY: 'test',
      S3_BUCKET: 'test-bucket',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SESSION_SECRET: '12345678901234567890123456789012',
      ADMIN_BASE_URL: 'http://localhost:5173',
      STORAGE_PROVIDER: 'local',
      STORAGE_LOCAL_PATH: '/tmp/storage-test',
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
});
