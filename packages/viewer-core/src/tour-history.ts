export interface HistoryEntry {
  shareToken: string;
  sceneId: string;
  yaw: number;
  pitch: number;
}

export interface TourHistory {
  push(entry: HistoryEntry): void;
  pop(): HistoryEntry | null;
  peek(): HistoryEntry | null;
  canGoBack(): boolean;
  size(): number;
  clear(): void;
}

export function createTourHistory(max = 20): TourHistory {
  let stack: HistoryEntry[] = [];

  return {
    push(entry: HistoryEntry): void {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (
          top !== undefined &&
          top.shareToken === entry.shareToken &&
          top.sceneId === entry.sceneId
        ) {
          return;
        }
      }

      stack.push({ ...entry });

      if (stack.length > max) {
        stack.shift();
      }
    },

    pop(): HistoryEntry | null {
      if (stack.length === 0) {
        return null;
      }
      const entry = stack.pop();
      return entry !== undefined ? { ...entry } : null;
    },

    peek(): HistoryEntry | null {
      if (stack.length === 0) {
        return null;
      }
      const entry = stack[stack.length - 1];
      return entry !== undefined ? { ...entry } : null;
    },

    canGoBack(): boolean {
      return stack.length > 0;
    },

    size(): number {
      return stack.length;
    },

    clear(): void {
      stack = [];
    }
  };
}
