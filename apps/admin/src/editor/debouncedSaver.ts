export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function createDebouncedSaver<V>(
  save: (key: string, value: V) => Promise<void>,
  onStatus: (status: SaveStatus) => void,
  delayMs = 1000
) {
  let pendingMap = new Map<string, V>();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let savePromise: Promise<void> | null = null;

  const executeSaves = async (mapToSave: Map<string, V>) => {
    onStatus('saving');
    
    const entries = Array.from(mapToSave.entries());
    const results = await Promise.allSettled(
      entries.map(async ([k, v]) => {
        await save(k, v);
      })
    );

    let hasError = false;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const result = results[i];
      if (entry && result && result.status === 'rejected') {
        hasError = true;
        const [k, v] = entry;
        if (!pendingMap.has(k)) {
          pendingMap.set(k, v);
        }
      }
    }

    if (hasError) {
      onStatus('error');
    } else if (pendingMap.size === 0) {
      onStatus('saved');
    } else {
      onStatus('pending');
    }
  };

  const schedule = (key: string, value: V) => {
    pendingMap.set(key, value);
    onStatus('pending');

    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      if (pendingMap.size > 0) {
        const mapToSave = pendingMap;
        pendingMap = new Map();
        savePromise = (savePromise || Promise.resolve())
          .then(() => executeSaves(mapToSave))
          .catch(() => {});
      }
    }, delayMs);
  };

  const flush = async () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }

    if (pendingMap.size > 0) {
      const mapToSave = pendingMap;
      pendingMap = new Map();
      savePromise = (savePromise || Promise.resolve())
        .then(() => executeSaves(mapToSave))
        .catch(() => {});
    }

    if (savePromise) {
      await savePromise;
    }
  };

  const retry = async () => {
    if (savePromise) {
      await savePromise;
    }
    return flush();
  };

  const cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    pendingMap.clear();
    onStatus('idle');
  };

  const getPendingKeys = () => Array.from(pendingMap.keys());

  return { schedule, flush, cancel, retry, getPendingKeys };
}
