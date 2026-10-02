import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { S3_CLIENT } from '../health/health.probes.js';

export const UPLOAD_URL_TTL_SECONDS = 900;

@Injectable()
export class StorageService {
  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async presignPut(
    key: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });
    return getSignedUrl(this.s3, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  async head(
    key: string,
  ): Promise<{ sizeBytes: number; contentType: string | undefined } | null> {
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

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }),
    );
  }
}
