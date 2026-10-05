import fs from 'node:fs';
import path from 'node:path';

import {
  AssetKind,
  AssetResponseSchema,
  AssetUploadRequestSchema,
  AssetUploadResponseSchema,
  ProcessingStatus,
  z,
} from '@xplor/shared';

import { parseArgs, runPool } from './import-lib.js';

try {
  process.loadEnvFile('.env');
} catch {
  // Ignore si le fichier n'existe pas
}

process.env.XPLOR_API_URL = process.env.XPLOR_API_URL || `http://localhost:${process.env.PORT || '3000'}`;
if (!process.env.XPLOR_ADMIN_EMAIL) process.env.XPLOR_ADMIN_EMAIL = 'admin@xplor.local';

const args = parseArgs(process.argv.slice(2), process.env);

let csrfToken: string | undefined;
let cookieHeader = '';

async function apiFetch(apiPath: string, init: RequestInit = {}): Promise<Response> {
  const url = `${args.apiUrl}${apiPath}`;
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

async function login(): Promise<void> {
  if (!args.email || !args.password) {
    throw new Error('Email et mot de passe requis pour la connexion.');
  }
  const res = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: args.email, password: args.password }),
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createTour(_assetIds: Record<string, string>): Promise<void> {
  // Vide pour le moment
}

async function uploadFile(
  fileName: string,
  index: number,
  total: number
): Promise<{ file: string; assetId: string }> {
  const fullPath = path.join(args.dir, fileName);
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

  // 4. Interrogation jusqu'au statut READY
  const pollInterval = 2000;
  const maxPolls = Math.max(1, Math.floor((args.timeoutSec * 1000) / pollInterval));

  for (let i = 0; i < maxPolls; i++) {
    const getResRaw = await apiFetch(`/api/v1/admin/assets/${uploadRes.assetId}`);
    if (!getResRaw.ok) {
      throw new Error(`GET asset échoué pour ${fileName} : ${String(getResRaw.status)} - ${await getResRaw.text()}`);
    }
    const getRes = AssetResponseSchema.parse(await getResRaw.json());

    if (getRes.processingStatus === ProcessingStatus.READY) {
      console.log(`[Succès] ${fileName} est READY (${String(index + 1)}/${String(total)} envoyé)`);
      return { file: fileName, assetId: uploadRes.assetId };
    }

    if (getRes.processingStatus === ProcessingStatus.ERROR) {
      throw new Error(`Erreur de traitement pour ${fileName} : ${getRes.processingLog || 'Raison inconnue'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Délai d'attente dépassé pour ${fileName}`);
}

async function main() {
  const dataPath = path.resolve('scripts/oudayas/tour-data.json');
  const rawData: unknown = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  const TourDataSchema = z.object({
    title: z.string(),
    scenes: z.array(z.object({
      file: z.string(),
      name: z.string(),
    })),
  });
  
  const data = TourDataSchema.parse(rawData);

  const files = data.scenes.map((s) => s.file);

  if (args.dryRun) {
    console.log(`[Dry-Run] Planification de l'import :`);
    console.log(`- Titre : ${data.title}`);
    console.log(`- Nombre de scènes : ${String(files.length)}`);
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

  await login();
  console.log('Connexion réussie.');

  for (const file of files) {
    const fullPath = path.join(args.dir, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier introuvable avant l'upload : ${fullPath}`);
    }
  }

  const results = await runPool(files, args.concurrency, (file, index) =>
    uploadFile(file, index, files.length)
  );

  const assetIds: Record<string, string> = {};
  for (const r of results) {
    assetIds[r.file] = r.assetId;
  }

  await createTour(assetIds);
  console.log('Importation terminée avec succès.');
}

main().catch((err: unknown) => {
  console.error('Erreur fatale :', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
