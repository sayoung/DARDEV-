import { z, TourResponse } from '@xplor/shared';

export interface ImportOptions {
  apiUrl: string;
  email?: string;
  password?: string;
  dir: string;
  replace: boolean;
  dryRun: boolean;
  timeoutSec: number;
  concurrency: number;
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv): ImportOptions {
  let replace = false;
  let dryRun = false;
  let timeoutSec = 600;
  let concurrency = 3;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;

    if (arg === '--replace') {
      replace = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--timeout') {
      const val = argv[++i];
      if (val === undefined || !/^\d+$/.test(val)) {
        throw new Error('Option --timeout requires a numeric value in seconds.');
      }
      timeoutSec = parseInt(val, 10);
    } else if (arg === '--concurrency') {
      const val = argv[++i];
      if (val === undefined || !/^\d+$/.test(val)) {
        throw new Error('Option --concurrency requires a numeric value.');
      }
      concurrency = parseInt(val, 10);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const apiUrl = env.XPLOR_API_URL;
  if (!apiUrl) {
    throw new Error('Environment variable XPLOR_API_URL is missing.');
  }

  const email = env.XPLOR_ADMIN_EMAIL;
  const password = env.XPLOR_ADMIN_PASSWORD;

  if (!dryRun) {
    if (email === undefined) {
      throw new Error('Environment variable XPLOR_ADMIN_EMAIL is missing.');
    }
    if (password === undefined) {
      throw new Error('Environment variable XPLOR_ADMIN_PASSWORD is missing.');
    }
  }

  const dir = env.XPLOR_OUDAYAS_DIR ?? 'D:/DARDEV/local/xplor-panoramas-test/visite-oudayas/pano';

  const schema = z.object({
    apiUrl: z.string().min(1, 'XPLOR_API_URL must not be empty.'),
    email: z.string().min(1, 'XPLOR_ADMIN_EMAIL must not be empty.').optional(),
    password: z.string().min(1, 'XPLOR_ADMIN_PASSWORD must not be empty.').optional(),
    dir: z.string().min(1, 'Directory must not be empty.'),
    replace: z.boolean(),
    dryRun: z.boolean(),
    timeoutSec: z.number().int().min(1, 'Timeout must be positive.'),
    concurrency: z.number().int().min(1, 'Concurrency must be at least 1.').max(3, 'Option --concurrency max limit is 3.'),
  });

  const parsed = schema.safeParse({
    apiUrl,
    email,
    password,
    dir,
    replace,
    dryRun,
    timeoutSec,
    concurrency,
  });

  if (!parsed.success) {
    // Clean issues to absolutely avoid any potential leak in custom Zod errors
    const errs = parsed.error.issues.map((i: { path: (string | number | symbol)[]; message: string }) => {
      // Don't output the actual value for the password field if Zod ever includes it
      if (i.path.includes('password')) {
        return 'password: Invalid format';
      }
      return `${i.path.join('.')}: ${i.message}`;
    }).join(', ');
    throw new Error(`Validation failed: ${errs}`);
  }

  return parsed.data;
}

export async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let currentIndex = 0;
  let completed = 0;
  const total = items.length;

  console.log(`[Pool] Démarrage du traitement de ${String(total)} éléments avec une concurrence de ${String(limit)}.`);

  const workers = Array.from({ length: Math.min(limit, total) }).map(async (_, workerId) => {
    while (currentIndex < total) {
      const index = currentIndex++;
      const item = items[index];
      if (item === undefined) continue;

      try {
        results[index] = await worker(item, index);
      } catch (err) {
        console.error(`[Pool] Erreur lors du traitement de l'élément ${String(index)} (worker ${String(workerId)}).`);
        throw err;
      }
      completed++;
      console.log(`[Pool] Progression : ${String(completed)}/${String(total)} terminé(s).`);
    }
  });

  await Promise.all(workers);
  return results;
}

export function findExistingTour(tours: TourResponse[], titleFr: string): TourResponse | undefined {
  return tours.find((t) => t.title.fr === titleFr);
}

export function publicUrl(token: string): string {
  return `https://v.xplor.ma/v/${token}`;
}
