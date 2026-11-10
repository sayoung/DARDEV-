import { ConsoleLogger } from '@nestjs/common';

export function createAppLogger(nodeEnv: string): ConsoleLogger {
  return new ConsoleLogger({
    json: nodeEnv === 'production',
  });
}
