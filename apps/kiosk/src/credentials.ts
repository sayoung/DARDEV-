import { z } from '@xplor/shared';

export const KioskCredentialsSchema = z.object({
  kioskId: z.uuid(),
  token: z.string().min(1),
});

export type KioskCredentials = z.infer<typeof KioskCredentialsSchema>;

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const KIOSK_CREDENTIALS_KEY = 'xplor.kiosk.credentials';

export function saveCredentials(storage: Storage, credentials: KioskCredentials): void {
  const validCredentials = KioskCredentialsSchema.parse(credentials);
  storage.setItem(KIOSK_CREDENTIALS_KEY, JSON.stringify(validCredentials));
}

export function loadCredentials(storage: Storage): KioskCredentials | null {
  const serialized = storage.getItem(KIOSK_CREDENTIALS_KEY);
  if (serialized === null) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    const result = KioskCredentialsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function clearCredentials(storage: Storage): void {
  storage.removeItem(KIOSK_CREDENTIALS_KEY);
}
