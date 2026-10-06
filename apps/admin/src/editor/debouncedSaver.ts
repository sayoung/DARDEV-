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
    
    try {
      const promises = Array.from(mapToSave.entries()).map(([k, v]) => save(k, v));
      await Promise.all(promises);
      
      if (pendingMap.size === 0) {
        onStatus('saved');
      } else {
        onStatus('pending');
      }
    } catch {
      onStatus('error');
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
        savePromise = (savePromise || Promise.resolve()).then(() => executeSaves(mapToSave));
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
      savePromise = (savePromise || Promise.resolve()).then(() => executeSaves(mapToSave));
    }

    if (savePromise) {
      await savePromise;
    }
  };

  const cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    pendingMap.clear();
    onStatus('idle');
  };

  return { schedule, flush, cancel };
}
