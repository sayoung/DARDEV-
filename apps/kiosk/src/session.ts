export interface SessionManager {
  start: () => string;
  current: () => string | null;
  end: () => string | null;
}

export function createSessionManager(
  generateId: () => string = () => crypto.randomUUID(),
): SessionManager {
  let sessionId: string | null = null;

  return {
    start: () => {
      sessionId = generateId();
      return sessionId;
    },
    current: () => sessionId,
    end: () => {
      const endedSessionId = sessionId;
      sessionId = null;
      return endedSessionId;
    },
  };
}
