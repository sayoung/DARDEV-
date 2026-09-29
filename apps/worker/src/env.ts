import { z } from 'zod';

const envSchema = z.object({
  REDIS_URL: z.string().min(1),
});

export type WorkerEnv = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined>): WorkerEnv {
  const picked: { REDIS_URL?: string } = {};
  const redisUrl = source.REDIS_URL;
  if (redisUrl !== undefined && redisUrl !== '') {
    picked.REDIS_URL = redisUrl;
  }
  const parsed = envSchema.safeParse(picked);
  if (!parsed.success) {
    throw new Error('Invalid environment variables: REDIS_URL');
  }
  return parsed.data;
}
