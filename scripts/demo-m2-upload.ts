import fs from 'node:fs';
import path from 'node:path';

import {
  AssetKind,
  AssetResponseSchema,
  AssetUploadRequestSchema,
  AssetUploadResponseSchema,
  ProcessingStatus,
} from '@xplor/shared';

import {
  listPanoramaFiles,
  summarize,
  type ProcessingResult,
} from './demo-m2-lib.js';

try {
  process.loadEnvFile('.env');
} catch {
  // Ignore si le fichier n'existe pas
}

const XPLOR_DEMO_PANOS =
  process.env.XPLOR_DEMO_PANOS || 'D:/DARDEV/local/xplor-panoramas-test';
const PORT = process.env.PORT || '3000';
const XPLOR_API_URL = process.env.XPLOR_API_URL || `http://localhost:${PORT}`;
const SEED_DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;

if (!SEED_DEFAULT_PASSWORD) {
  console.error("Erreur : la variable d'environnement SEED_DEFAULT_PASSWORD est absente.");
  process.exit(1);
}

const ADMIN_EMAIL = 'admin@xplor.local';

let csrfToken: string | undefined;
let cookieHeader = '';

async function apiFetch(apiPath: string, init: RequestInit = {}): Promise<Response> {
  const url = `${XPLOR_API_URL}${apiPath}`;
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
  const res = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: SEED_DEFAULT_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Échec de connexion : ${String(res.status)}`);
  }
  const body = (await res.json()) as unknown;
  // On parse avec un schéma minimal ou on utilise MeResponseSchema si on l'importe
  if (typeof body === 'object' && body !== null && 'csrfToken' in body) {
    const safeBody = body as { csrfToken?: unknown };
    csrfToken = typeof safeBody.csrfToken === 'string' ? safeBody.csrfToken : undefined;
  }
}

async function processFile(
  item: { file: string; expectInvalid: boolean },
  panoramasDir: string
): Promise<ProcessingResult> {
  const start = performance.now();
  let status: ProcessingStatus | 'TIMEOUT' = ProcessingStatus.ERROR;
  let dimensions = null;
  let raison: string | undefined;

  try {
    const fullPath = path.join(panoramasDir, item.file);
    const stats = fs.statSync(fullPath);

    // 1. Demande d'upload
    const reqBody = {
      kind: AssetKind.PANORAMA,
      mimeType: item.file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
      sizeBytes: stats.size,
      filename: item.file,
    };
    const uploadResRaw = await apiFetch('/api/v1/admin/assets/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(AssetUploadRequestSchema.parse(reqBody)),
    });
    if (!uploadResRaw.ok) {
      throw new Error(`upload-url échoué : ${String(uploadResRaw.status)} - ${await uploadResRaw.text()}`);
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
      throw new Error(`PUT échoué : ${String(putRes.status)} - ${await putRes.text()}`);
    }

    // 3. Finalisation (complete)
    const completeResRaw = await apiFetch(`/api/v1/admin/assets/${uploadRes.assetId}/complete`, {
      method: 'POST',
    });
    if (!completeResRaw.ok) {
      throw new Error(`complete échoué : ${String(completeResRaw.status)} - ${await completeResRaw.text()}`);
    }

    // 4. Interrogation
    const maxPolls = 150; // 5 min avec 2s d'intervalle
    let currentStatus = ProcessingStatus.PENDING;
    let getRes;

    for (let i = 0; i < maxPolls; i++) {
      const getResRaw = await apiFetch(`/api/v1/admin/assets/${uploadRes.assetId}`);
      if (!getResRaw.ok) {
        throw new Error(`GET asset échoué : ${String(getResRaw.status)} - ${await getResRaw.text()}`);
      }
      getRes = AssetResponseSchema.parse(await getResRaw.json());
      currentStatus = getRes.processingStatus;

      if (currentStatus === ProcessingStatus.READY || currentStatus === ProcessingStatus.ERROR) {
        if (currentStatus === ProcessingStatus.READY) {
          dimensions = { width: getRes.width ?? 0, height: getRes.height ?? 0 };
        } else {
          raison = getRes.processingLog || 'Pas de processingLog fourni';
        }
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (currentStatus !== ProcessingStatus.READY && currentStatus !== ProcessingStatus.ERROR) {
      status = 'TIMEOUT';
      raison = 'Délai d\'attente dépassé';
    } else {
      status = currentStatus;
    }
  } catch (err) {
    status = ProcessingStatus.ERROR;
    raison = err instanceof Error ? err.message : String(err);
  }

  const durationSeconds = Math.round((performance.now() - start) / 1000);

  return {
    file: item.file,
    dimensions,
    status,
    durationSeconds,
    expectInvalid: item.expectInvalid,
    raison,
  };
}

async function main() {
  await login();

  const files = fs.readdirSync(XPLOR_DEMO_PANOS);
  const toProcess = listPanoramaFiles(files);

  const results: ProcessingResult[] = [];
  for (const item of toProcess) {
    const result = await processFile(item, XPLOR_DEMO_PANOS);
    results.push(result);
  }

  console.table(results);

  const { exitCode, lines } = summarize(results);
  if (lines.length > 0) {
    console.log(lines.join('\n'));
  }
  process.exit(exitCode);
}

main().catch((error: unknown) => {
  console.error('Erreur fatale :', error);
  process.exit(1);
});
