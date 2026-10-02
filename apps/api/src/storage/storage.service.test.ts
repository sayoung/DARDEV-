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
import { StorageService } from './storage.service.js';

describe('StorageService', () => {
  let s3: S3Client;
  let env: Env;
  let service: StorageService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sendSpy: MockInstance<any>;

  beforeEach(() => {
    s3 = new S3Client({
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
    // We use vi.spyOn to avoid unbound method errors
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
    };
    service = new StorageService(s3, env);
  });

  describe('presignPut', () => {
    it('should generate a presigned URL with the correct key and expiration', async () => {
      const url = await service.presignPut('test-key.jpg', 'image/jpeg', 1024);
      expect(url).toContain('test-bucket');
      expect(url).toContain('test-key.jpg');
      expect(url).toContain('X-Amz-Expires=900');
    });
  });

  describe('head', () => {
    it('should return size and contentType when object exists', async () => {
      const mockResponse: HeadObjectCommandOutput = {
        $metadata: {},
        ContentLength: 1024,
        ContentType: 'image/jpeg',
      };
      sendSpy.mockResolvedValueOnce(mockResponse);

      const result = await service.head('test-key.jpg');
      expect(sendSpy).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(result).toEqual({ sizeBytes: 1024, contentType: 'image/jpeg' });
    });

    it('should return null when object is not found (name = NotFound)', async () => {
      const error = new Error('Not found');
      error.name = 'NotFound';
      sendSpy.mockRejectedValueOnce(error);

      const result = await service.head('test-key.jpg');
      expect(result).toBeNull();
    });

    it('should return null when object is not found (httpStatusCode = 404)', async () => {
      const error = new Error('Not found');
      Object.assign(error, { $metadata: { httpStatusCode: 404 } });
      sendSpy.mockRejectedValueOnce(error);

      const result = await service.head('test-key.jpg');
      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      const error = new Error('Unknown error');
      sendSpy.mockRejectedValueOnce(error);

      await expect(service.head('test-key.jpg')).rejects.toThrow('Unknown error');
    });
  });

  describe('getRange', () => {
    it('should request the specified byte range and return a Buffer', async () => {
      const mockBody = {
        transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };

      const mockResponse: GetObjectCommandOutput = {
        $metadata: {},
        Body: mockBody as never,
      };
      sendSpy.mockResolvedValueOnce(mockResponse);

      const result = await service.getRange('test-key.jpg', 0, 65535);

      expect(sendSpy).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      const callArgs = sendSpy.mock.calls[0];
      if (callArgs && callArgs[0] instanceof GetObjectCommand) {
        expect(callArgs[0].input.Range).toBe('bytes=0-65535');
      } else {
        throw new Error('Expected GetObjectCommand');
      }
      expect(result).toBeInstanceOf(Buffer);
      expect(result).toEqual(Buffer.from([1, 2, 3]));
    });

    it('should throw if response has no body', async () => {
      const mockResponse: GetObjectCommandOutput = {
        $metadata: {},
      };
      sendSpy.mockResolvedValueOnce(mockResponse);
      await expect(service.getRange('test-key.jpg', 0, 65535)).rejects.toThrow(
        'No body in response',
      );
    });
  });

  describe('delete', () => {
    it('should send a DeleteObjectCommand', async () => {
      const mockResponse: DeleteObjectCommandOutput = {
        $metadata: {},
      };
      sendSpy.mockResolvedValueOnce(mockResponse);
      await service.delete('test-key.jpg');
      expect(sendSpy).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });
});
