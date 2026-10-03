import { describe, it, expect } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { formatCliError } from './format-error.js';

describe('formatCliError', () => {
  it("doit extraire le message d'une erreur standard", () => {
    const error = new Error("Message d'erreur standard");
    expect(formatCliError(error)).toBe("Message d'erreur standard");
  });

  it("doit extraire le message d'une HttpException avec le format Xplor ({ error: { message } })", () => {
    const error = new HttpException(
      { error: { code: 'ASSET_NOT_FOUND', message: 'Ce média est inconnu.' } },
      HttpStatus.NOT_FOUND,
    );
    expect(formatCliError(error)).toBe('Ce média est inconnu.');
  });

  it('doit se rabattre sur le message par défaut si le format est inattendu', () => {
    const error = new HttpException('Just a string response', HttpStatus.BAD_REQUEST);
    expect(formatCliError(error)).toBe('Just a string response');
  });

  it('doit gérer les erreurs inconnues', () => {
    expect(formatCliError('chaîne de caractères')).toBe('Erreur inattendue.');
    expect(formatCliError(null)).toBe('Erreur inattendue.');
  });
});
