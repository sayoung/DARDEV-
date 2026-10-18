export const DEFAULT_API_URL = 'http://localhost:3000';

export function resolveApiUrl(env: { VITE_API_URL?: string }): string {
  const raw = env.VITE_API_URL?.trim();
  if (!raw) {
    return DEFAULT_API_URL;
  }
  const stripped = raw.replace(/\/+$/, '');
  return stripped.length > 0 ? stripped : DEFAULT_API_URL;
}
