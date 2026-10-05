import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const portSchema = z.coerce.number().int().min(1).max(65_535);

const corsOriginsSchema = z
  .string()
  .transform((val) => val.split(',').map((s) => s.trim()))
  .pipe(z.array(z.url()));

const envKeys = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'S3_ENDPOINT',
  'S3_PUBLIC_ENDPOINT',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SESSION_SECRET',
  'ADMIN_BASE_URL',
  'STORAGE_PROVIDER',
  'STORAGE_LOCAL_PATH',
  'API_PUBLIC_URL',
  'MEDIA_PUBLIC_URL',
  'PUBLIC_WEB_URL',
  'API_CORS_ORIGINS',
  'API_TRUST_PROXY',
] as const;

export const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: portSchema.default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_PUBLIC_ENDPOINT: z
    .url()
    .refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
      message: 'Le protocole doit être http ou https',
    })
    .optional(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: portSchema,
  SESSION_SECRET: z.string().min(32),
  ADMIN_BASE_URL: z.url().default('http://localhost:5173'),
  STORAGE_PROVIDER: z.enum(['s3', 'local']).default('s3'),
  STORAGE_LOCAL_PATH: z.string().optional(),
  API_PUBLIC_URL: z.url().default('http://localhost:3000'),
  MEDIA_PUBLIC_URL: z
    .url()
    .refine((val) => !val.endsWith('/'), { message: "L'URL ne doit pas se terminer par un '/'" })
    .default('http://localhost:9000/xplor'),
  PUBLIC_WEB_URL: z
    .url()
    .refine((val) => !val.endsWith('/'), { message: "L'URL ne doit pas se terminer par un '/'" })
    .default('http://localhost:5174'),
  API_CORS_ORIGINS: z.string().optional(),
  API_TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
})
.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.API_CORS_ORIGINS) {
    ctx.addIssue({
      code: 'custom',
      path: ['API_CORS_ORIGINS'],
      message: 'Obligatoire en production',
    });
  }
})
.transform((env, ctx) => {
  const rawOrigins =
    env.API_CORS_ORIGINS ||
    'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174';

  const parsedOrigins = corsOriginsSchema.safeParse(rawOrigins);
  if (!parsedOrigins.success) {
    for (const issue of parsedOrigins.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ['API_CORS_ORIGINS', ...issue.path],
      });
    }
    return z.NEVER;
  }

  return {
    ...env,
    S3_PUBLIC_ENDPOINT: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
    API_CORS_ORIGINS: parsedOrigins.data,
  };
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
