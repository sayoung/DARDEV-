import { describe, it, expect, vi } from 'vitest';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3WorkerStorage, createS3Client } from './storage.js';
import { WorkerEnv } from './env.js';

describe('S3WorkerStorage', () => {
  it('getObject renvoie le buffer attendu', async () => {
    const mockSend = vi.fn().mockImplementation((command: GetObjectCommand) => {
      expect(command.input.Bucket).toBe('test-bucket');
      expect(command.input.Key).toBe('test-key');
      return Promise.resolve({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2, 3])),
        },
      });
    });
    // cast unique documenté pour mocker le client S3
    const mockClient = { send: mockSend } as unknown as S3Client;
    const storage = new S3WorkerStorage(mockClient, 'test-bucket');

    const result = await storage.getObject('test-key');
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString('hex')).toBe(Buffer.from([1, 2, 3]).toString('hex'));
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('getObject lève une erreur si Body est absent', async () => {
    const mockSend = vi.fn().mockResolvedValue({});
    const mockClient = { send: mockSend } as unknown as S3Client;
    const storage = new S3WorkerStorage(mockClient, 'test-bucket');

    await expect(storage.getObject('empty-key')).rejects.toThrow('Objet empty-key vide ou introuvable.');
  });

  it('putObject envoie la bonne commande', async () => {
    const body = Buffer.from([4, 5, 6]);
    const mockSend = vi.fn().mockImplementation((command: PutObjectCommand) => {
      expect(command.input.Bucket).toBe('test-bucket');
      expect(command.input.Key).toBe('out-key');
      expect(command.input.Body).toBe(body);
      expect(command.input.ContentType).toBe('image/jpeg');
      expect(command.input.CacheControl).toBe('public, max-age=31536000, immutable');
      return Promise.resolve({});
    });
    const mockClient = { send: mockSend } as unknown as S3Client;
    const storage = new S3WorkerStorage(mockClient, 'test-bucket');

    await storage.putObject('out-key', body, 'image/jpeg');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe('createS3Client', () => {
  it('crée un client configuré avec les variables d\'environnement', () => {
    const env: WorkerEnv = {
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgres://user:pass@localhost/db',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'test-access',
      S3_SECRET_KEY: 'test-secret',
      S3_BUCKET: 'test-bucket',
    };

    const client = createS3Client(env);
    expect(client).toBeInstanceOf(S3Client);
    // On ne peut pas facilement inspecter la configuration interne du S3Client
    // de manière synchrone sans config resolver complet, mais on vérifie au moins
    // l'instanciation.
  });
});
