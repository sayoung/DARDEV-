import { z } from 'zod';

const envSchema = z.object({
  REDIS_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  STORAGE_PROVIDER: z.enum(['s3', 'local']).optional().default('s3'),
});

export type WorkerEnv = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined>): WorkerEnv {
  const picked: Record<string, string | undefined> = {};
  const keys = ['REDIS_URL', 'DATABASE_URL', 'S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET', 'STORAGE_PROVIDER'] as const;
  
  for (const key of keys) {
    const val = source[key];
    if (val !== undefined && val !== '') {
      picked[key] = val;
    }
  }

  const parsed = envSchema.safeParse(picked);
  if (!parsed.success) {
    const missingKeys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment variables: ${missingKeys}`);
  }
  return parsed.data;
}
