import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AssetKind,
  AssetResponseSchema,
  AssetUploadRequestSchema,
  AssetUploadResponseSchema,
  ProcessingStatus,
  z,
  TourResponse,
  PaginatedTourResponseSchema,
  CityListResponseSchema,
  CategoryListResponseSchema,
} from '@xplor/shared';

import { parseArgs, runPool, countPlannedHotspots, fetchAllPages, matchCity, matchCategory } from './import-lib.js';
import { buildTourPlan, generateId } from './plan.js';
export let csrfToken: string | undefined;
export let cookieHeader = '';
export let apiUrl = 'http://localhost:3000';

export async function apiFetch(apiPath: string, init: RequestInit = {}): Promise<Response> {
  const url = `${apiUrl}${apiPath}`;
  const headers = new Headers(init.headers);
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const res = await fetch(url, { ...init, headers });

  const cookies = res.headers.getSetCookie();
  if (cookies.length > 0) {
    cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
  }

  return res;
}

export async function login(email?: string, password?: string): Promise<void> {
  if (!email || !password) {
    throw new Error('Email et mot de passe requis pour la connexion.');
  }
  const res = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Échec de connexion : ${String(res.status)}`);
  }
  const body: unknown = await res.json();
  const LoginResponseSchema = z.object({
    csrfToken: z.string().optional(),
  });
  const parsed = LoginResponseSchema.safeParse(body);
  if (parsed.success && parsed.data.csrfToken) {
    csrfToken = parsed.data.csrfToken;
  }
}

// TODO: implémenter la création de visite en partie C
export async function createTour(_assetIds: Record<string, string>): Promise<void> {
  await Promise.resolve(_assetIds);
  // Vide pour le moment
}

export async function listTours(): Promise<TourResponse[]> {
  return fetchAllPages(async (page) => {
    const res = await apiFetch(`/api/v1/admin/tours?page=${String(page)}`);
    if (!res.ok) {
      throw new Error(`[liste visites] Erreur HTTP ${String(res.status)}`);
    }
    const data: unknown = await res.json();
    const paginatedRes = PaginatedTourResponseSchema.parse(data);
    return {
      data: paginatedRes.items,
      hasMore: paginatedRes.page * paginatedRes.pageSize < paginatedRes.total,
    };
  });
}

export async function resolveReferences(tourData: { city: string }): Promise<{ cityId: string; categoryId: string }> {
  const citiesRes = await apiFetch('/api/v1/admin/cities');
  if (!citiesRes.ok) {
    throw new Error(`[référentiel] Erreur HTTP ${String(citiesRes.status)} sur les villes`);
  }
  const citiesData: unknown = await citiesRes.json();
  const cities = CityListResponseSchema.parse(citiesData);

  const categoriesRes = await apiFetch('/api/v1/admin/categories');
  if (!categoriesRes.ok) {
    throw new Error(`[référentiel] Erreur HTTP ${String(categoriesRes.status)} sur les catégories`);
  }
  const categoriesData: unknown = await categoriesRes.json();
  const categories = CategoryListResponseSchema.parse(categoriesData);

  const matchedCity = matchCity(cities, tourData.city);
  const matchedCategory = matchCategory(categories);

  return {
    cityId: matchedCity.id,
    categoryId: matchedCategory.id,
  };
}

export async function uploadFile(
  fileName: string,
  dir: string
): Promise<{ file: string; assetId: string }> {
  const fullPath = path.join(dir, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Fichier introuvable : ${fullPath}`);
  }

  const stats = fs.statSync(fullPath);

  // 1. Demande d'upload
  const reqBody = {
    kind: AssetKind.PANORAMA,
    mimeType: fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
    sizeBytes: stats.size,
    filename: fileName,
  };

  const uploadResRaw = await apiFetch('/api/v1/admin/assets/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(AssetUploadRequestSchema.parse(reqBody)),
  });

  if (!uploadResRaw.ok) {
    throw new Error(`upload-url échoué pour ${fileName} : ${String(uploadResRaw.status)} - ${await uploadResRaw.text()}`);
  }

  const uploadRes = AssetUploadResponseSchema.parse(await uploadResRaw.json());

  // 2. Upload (PUT)
  const fileBuffer = fs.readFileSync(fullPath);
  const putRes = await fetch(uploadRes.uploadUrl, {
    method: uploadRes.uploadMethod,
    headers: { 'Content-Type': reqBody.mimeType },
    body: fileBuffer,
  });

  if (!putRes.ok) {
    throw new Error(`PUT échoué pour ${fileName} : ${String(putRes.status)} - ${await putRes.text()}`);
  }

  // 3. Finalisation (complete)
  const completeResRaw = await apiFetch(`/api/v1/admin/assets/${uploadRes.assetId}/complete`, {
    method: 'POST',
  });

  if (!completeResRaw.ok) {
    throw new Error(`complete échoué pour ${fileName} : ${String(completeResRaw.status)} - ${await completeResRaw.text()}`);
  }

  return { file: fileName, assetId: uploadRes.assetId };
}

export async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Ignore si le fichier n'existe pas
  }

  env.XPLOR_API_URL = env.XPLOR_API_URL || `http://localhost:${env.PORT || '3000'}`;
  if (!env.XPLOR_ADMIN_EMAIL) env.XPLOR_ADMIN_EMAIL = 'admin@xplor.local';

  const args = parseArgs(argv.slice(2), env);
  apiUrl = args.apiUrl;

  const dataPath = path.resolve('scripts/oudayas/tour-data.json');
  const rawData: unknown = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  const TourDataSchema = z.object({
    title: z.string(),
    city: z.string(),
    description: z.string(),
    scenes: z.array(z.object({
      file: z.string(),
      name: z.string(),
      info: z.string(),
    })),
  });
  
  const data = TourDataSchema.parse(rawData);
  const files = data.scenes.map((s) => s.file);

  if (args.dryRun) {
    console.log(`[Dry-Run] Planification de l'import :`);
    console.log(`- Titre : ${data.title}`);
    console.log(`- Nombre de scènes : ${String(files.length)}`);
    
    const fakeAssetIds: Record<string, string> = {};
    for (const file of files) {
      fakeAssetIds[file] = generateId();
    }
    const plan = buildTourPlan(data, fakeAssetIds);
    console.log(`- Hotspots prévus : ${String(countPlannedHotspots(plan))}`);

    console.log(`- Fichiers à importer :`);
    let hasError = false;
    for (const file of files) {
      const fullPath = path.join(args.dir, file);
      if (fs.existsSync(fullPath)) {
        console.log(`  - ${file} (OK)`);
      } else {
        console.log(`  - ${file} (MANQUANT: ${fullPath})`);
        hasError = true;
      }
    }
    if (hasError) {
      process.exitCode = 1;
    }
    return;
  }

  await login(args.email, args.password);
  console.log('Connexion réussie.');

  for (const file of files) {
    const fullPath = path.join(args.dir, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier introuvable avant l'upload : ${fullPath}`);
    }
  }

  let uploadCount = 0;
  const results = await runPool(files, args.concurrency, async (file) => {
    const res = await uploadFile(file, args.dir);
    uploadCount++;
    console.log(`[Succès] ${file} est envoyé (${String(uploadCount)}/${String(files.length)} envoyé)`);
    return res;
  });

  const pollInterval = 2000;
  const maxPolls = Math.max(1, Math.floor((args.timeoutSec * 1000) / pollInterval));
  
  const pendingAssets = new Map<string, string>();
  for (const r of results) {
    pendingAssets.set(r.assetId, r.file);
  }
  
  for (let i = 0; i < maxPolls; i++) {
    if (pendingAssets.size === 0) break;
    
    for (const [assetId, file] of Array.from(pendingAssets.entries())) {
      const getResRaw = await apiFetch(`/api/v1/admin/assets/${assetId}`);
      if (!getResRaw.ok) {
        throw new Error(`GET asset échoué pour ${file} : ${String(getResRaw.status)} - ${await getResRaw.text()}`);
      }
      const getRes = AssetResponseSchema.parse(await getResRaw.json());
      
      if (getRes.processingStatus === ProcessingStatus.READY) {
        console.log(`[Succès] ${file} est READY`);
        pendingAssets.delete(assetId);
      } else if (getRes.processingStatus === ProcessingStatus.ERROR) {
        throw new Error(`Erreur de traitement pour ${file} : ${getRes.processingLog || 'Raison inconnue'}`);
      }
    }
    
    if (pendingAssets.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
  
  if (pendingAssets.size > 0) {
    const pendingFiles = Array.from(pendingAssets.values()).join(', ');
    throw new Error(`Délai d'attente dépassé pour : ${pendingFiles}`);
  }

  const assetIds: Record<string, string> = {};
  for (const r of results) {
    assetIds[r.file] = r.assetId;
  }

  await createTour(assetIds);
  console.log('Importation terminée avec succès.');
}

// @ts-expect-error: TS1470 - file is run with tsx which supports import.meta
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main(process.argv, process.env).catch((err: unknown) => {
    console.error('Erreur fatale :', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
