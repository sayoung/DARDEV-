import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { WorkerStorage } from './processors/panorama.processor.js';
import { WorkerEnv } from './env.js';

export class S3WorkerStorage implements WorkerStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async getObject(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`Objet ${key} vide ou introuvable.`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    });
    await this.client.send(command);
  }
}

export function createS3Client(env: WorkerEnv): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    region: 'us-east-1',
    forcePathStyle: true,
  });
}
