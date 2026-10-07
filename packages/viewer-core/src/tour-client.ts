import { TourGraphSchema, type TourGraph, type Lang } from '@xplor/shared';

export class TourNotFoundError extends Error {
  constructor() {
    super('Tour not found');
    this.name = 'TourNotFoundError';
  }
}

export class TourLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TourLoadError';
  }
}

async function fetchGraph(url: string, fetchImpl: typeof fetch): Promise<TourGraph> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (err) {
    throw new TourLoadError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (response.status === 404) {
    throw new TourNotFoundError();
  }

  if (!response.ok) {
    throw new TourLoadError(`Failed to fetch tour: ${String(response.status)} ${response.statusText}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new TourLoadError('Invalid JSON response');
  }

  const result = TourGraphSchema.safeParse(data);
  if (!result.success) {
    throw new TourLoadError(`Invalid tour data: ${result.error.message}`);
  }

  return result.data;
}

export async function fetchTourGraph(
  baseUrl: string,
  shareToken: string,
  lang: Lang,
  fetchImpl: typeof fetch = fetch
): Promise<TourGraph> {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = `${base}/public/tours/${encodeURIComponent(shareToken)}?lang=${lang}`;
  return fetchGraph(url, fetchImpl);
}

export async function fetchPreviewGraph(
  baseUrl: string,
  previewToken: string,
  lang: Lang,
  fetchImpl: typeof fetch = fetch
): Promise<TourGraph> {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = `${base}/public/preview/${encodeURIComponent(previewToken)}?lang=${lang}`;
  return fetchGraph(url, fetchImpl);
}
