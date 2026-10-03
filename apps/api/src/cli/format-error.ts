import { HttpException } from '@nestjs/common';

export function formatCliError(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (
      typeof response === 'object' &&
      'error' in response &&
      typeof response.error === 'object' &&
      response.error &&
      'message' in response.error &&
      typeof response.error.message === 'string'
    ) {
      return response.error.message;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Erreur inattendue.';
}
