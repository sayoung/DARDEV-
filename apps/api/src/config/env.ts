import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const portSchema = z.coerce.number().int().min(1).max(65_535);

const envKeys = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SESSION_SECRET',
] as const;

export const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: portSchema.default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: portSchema,
  SESSION_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(pickEnv(source));
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${formatInvalidEnv(parsed.error)}`);
  }
  return parsed.data;
}

function pickEnv(source: Record<string, string | undefined>): Record<string, string | undefined> {
  const picked: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    const value = source[key];
    if (value !== undefined && value !== '') {
      picked[key] = value;
    }
  }
  return picked;
}

function formatInvalidEnv(error: z.ZodError): string {
  const names: string[] = [];
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !names.includes(key)) {
      names.push(key);
    }
  }
  return names.length > 0 ? names.join(', ') : error.message;
}
