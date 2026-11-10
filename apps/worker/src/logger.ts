export interface WorkerLoggerOptions {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
}

export interface WorkerLogger {
  log: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: unknown) => void;
}

type LogLevel = 'log' | 'info' | 'warn' | 'error';

function formatError(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

function write(
  level: LogLevel,
  message: string,
  isProd: boolean,
  output: (chunk: string) => void,
): void {
  if (isProd) {
    output(JSON.stringify({ level, message, timestamp: Date.now() }) + '\n');
  } else {
    output(`[${level.toUpperCase()}] ${message}\n`);
  }
}

export function createWorkerLogger(
  nodeEnv: string = process.env.NODE_ENV ?? 'development',
  options?: WorkerLoggerOptions,
): WorkerLogger {
  const isProd = nodeEnv === 'production';
  const stdout = options?.stdout ?? ((chunk: string): void => {
    process.stdout.write(chunk);
  });
  const stderr = options?.stderr ?? ((chunk: string): void => {
    process.stderr.write(chunk);
  });

  return {
    log: (message: string): void => {
      write('log', message, isProd, stdout);
    },
    info: (message: string): void => {
      write('info', message, isProd, stdout);
    },
    warn: (message: string): void => {
      write('warn', message, isProd, stdout);
    },
    error: (message: unknown): void => {
      write('error', formatError(message), isProd, stderr);
    },
  };
}
