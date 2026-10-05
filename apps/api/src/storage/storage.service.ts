import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { S3_CLIENT } from '../health/health.probes.js';
import { signStorageToken } from './storage.utils.js';

export const UPLOAD_URL_TTL_SECONDS = 900;
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StorageService {
  generatePresignedUploadUrl(key: string, contentType: string, sizeBytes: number): Promise<string>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<{ sizeBytes: number; contentType: string | undefined } | null>;
  getRange(key: string, start: number, end: number): Promise<Buffer>;
}

@Injectable()
export class S3StorageService implements StorageService {
  private readonly publicS3: S3Client;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.publicS3 = new S3Client({
      endpoint: env.S3_PUBLIC_ENDPOINT,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }

  async generatePresignedUploadUrl(key: string, contentType: string, sizeBytes: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });
    return getSignedUrl(this.publicS3, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.env.S3_BUCKET,
      Key: key,
    });
    return getSignedUrl(this.publicS3, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
  }

  async headObject(key: string): Promise<{ sizeBytes: number; contentType: string | undefined } | null> {
    try {
      const result = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }),
      );
      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (('name' in error && error.name === 'NotFound') ||
          ('$metadata' in error &&
            typeof error.$metadata === 'object' &&
            error.$metadata !== null &&
            'httpStatusCode' in error.$metadata &&
            error.$metadata.httpStatusCode === 404))
      ) {
        return null;
      }
      throw error;
    }
  }

  async getRange(key: string, start: number, end: number): Promise<Buffer> {
    const result = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
        Range: `bytes=${start.toString(10)}-${end.toString(10)}`,
      }),
    );
    if (!result.Body) {
      throw new Error('No body in response');
    }
    const arr = await result.Body.transformToByteArray();
    return Buffer.from(arr);
  }
}

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly localPath: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.localPath = this.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage');
  }

  private getFilePath(key: string): string {
    return path.join(this.localPath, key);
  }

  generatePresignedUploadUrl(key: string, _contentType: string, sizeBytes: number): Promise<string> {
    const expiresAt = Date.now() + UPLOAD_URL_TTL_SECONDS * 1000;
    const token = signStorageToken(key, expiresAt, sizeBytes, this.env.SESSION_SECRET);
    const baseUrl = this.env.API_PUBLIC_URL || 'http://localhost:3000';
    return Promise.resolve(`${baseUrl}/api/v1/storage/upload/${token}`);
  }

  getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const expiresAt = Date.now() + expiresIn * 1000;
    const token = signStorageToken(key, expiresAt, 0, this.env.SESSION_SECRET);
    const baseUrl = this.env.API_PUBLIC_URL || 'http://localhost:3000';
    return Promise.resolve(`${baseUrl}/api/v1/storage/download/${token}`);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await fs.unlink(this.getFilePath(key));
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT') return;
      throw e;
    }
  }

  async headObject(key: string): Promise<{ sizeBytes: number; contentType: string | undefined } | null> {
    try {
      const stats = await fs.stat(this.getFilePath(key));
      return { sizeBytes: stats.size, contentType: undefined }; // Could infer from extension
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async getRange(key: string, start: number, end: number): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    let handle: fs.FileHandle | undefined;
    try {
      handle = await fs.open(filePath, 'r');
      const length = end - start + 1;
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      return buffer.subarray(0, bytesRead);
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT') throw new Error('Not found');
      throw e;
    } finally {
      if (handle) await handle.close();
    }
  }
}
