export type EditCommand = {
  kind: 'move';
  hotspotId: string;
  from: { yaw: number; pitch: number };
  to: { yaw: number; pitch: number };
};

export function createEditHistory(limit = 100) {
  let past: EditCommand[] = [];
  let future: EditCommand[] = [];

  return {
    push(cmd: EditCommand) {
      past.push(cmd);
      if (past.length > limit) {
        past.shift();
      }
      future = [];
    },
    undo(): EditCommand | null {
      const cmd = past.pop();
      if (!cmd) {
        return null;
      }
      future.push(cmd);
      return cmd;
    },
    redo(): EditCommand | null {
      const cmd = future.pop();
      if (!cmd) {
        return null;
      }
      past.push(cmd);
      return cmd;
    },
    canUndo(): boolean {
      return past.length > 0;
    },
    canRedo(): boolean {
      return future.length > 0;
    },
    clear() {
      past = [];
      future = [];
    },
  };
}
