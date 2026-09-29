import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS } from '../redis/redis.module.js';
import { type HealthProbe } from './health.service.js';

/** Région exigée par le SDK. MinIO ne l'utilise pas lorsque `forcePathStyle` est actif. */
const S3_REGION = 'us-east-1';

export const S3_CLIENT = Symbol('S3_CLIENT');

export function createS3Client(env: Env): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  });
}

@Injectable()
export class DbHealthProbe implements HealthProbe {
  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}

@Injectable()
export class RedisHealthProbe implements HealthProbe {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async run(): Promise<void> {
    await this.redis.ping();
  }
}

@Injectable()
export class StorageHealthProbe implements HealthProbe {
  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async run(): Promise<void> {
    await this.s3.send(new HeadBucketCommand({ Bucket: this.env.S3_BUCKET }));
  }
}
