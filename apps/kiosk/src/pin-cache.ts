import { z } from '@xplor/shared';

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const PinCacheRecordSchema = z.object({
  salt: z.string().min(1),
  hash: z.string().min(1),
});

export type PinCacheRecord = z.infer<typeof PinCacheRecordSchema>;

export const KIOSK_PIN_CACHE_KEY = 'xplor.kiosk.pinCache';

export interface PinCache {
  remember(pin: string): Promise<void>;
  verify(pin: string): Promise<boolean>;
  clear(): void;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      hex += byte.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

async function computeHash(
  subtle: SubtleCrypto,
  saltHex: string,
  pin: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${saltHex}${pin}`);
  const digest = await subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function createPinCache(
  storage: Storage,
  subtle: SubtleCrypto,
  randomBytes: (n: number) => Uint8Array,
  key: string = KIOSK_PIN_CACHE_KEY,
): PinCache {
  async function remember(pin: string): Promise<void> {
    const validPin = z.string().trim().min(1).parse(pin);
    const saltBytes = randomBytes(16);
    if (saltBytes.length === 0) {
      throw new Error('Échec de la génération du sel aléatoire');
    }
    const saltHex = bytesToHex(saltBytes);
    const hashHex = await computeHash(subtle, saltHex, validPin);
    const record: PinCacheRecord = {
      salt: saltHex,
      hash: hashHex,
    };
    const validRecord = PinCacheRecordSchema.parse(record);
    storage.setItem(key, JSON.stringify(validRecord));
  }

  async function verify(pin: string): Promise<boolean> {
    const trimmed = pin.trim();
    if (trimmed.length === 0) {
      return false;
    }
    const raw = storage.getItem(key);
    if (raw === null) {
      return false;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const parsedRecord = PinCacheRecordSchema.safeParse(parsed);
      if (!parsedRecord.success) {
        return false;
      }
      const record = parsedRecord.data;
      const expectedHash = await computeHash(subtle, record.salt, trimmed);
      return constantTimeEqual(expectedHash.toLowerCase(), record.hash.toLowerCase());
    } catch {
      return false;
    }
  }

  function clear(): void {
    storage.removeItem(key);
  }

  return {
    remember,
    verify,
    clear,
  };
}
