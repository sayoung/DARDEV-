import 'reflect-metadata';

import { readFileSync } from 'node:fs';

import { Injectable } from '@nestjs/common';
import { Algorithm, hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { PasswordSchema } from '@xplor/shared';

/**
 * Argon2id, paramètres par défaut de `@node-rs/argon2` 2.2 (OWASP : 19 MiB, 2 passes, 1 fil).
 * L'algorithme est fixé explicitement.
 */
const ARGON2ID_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * 10 000 mots de passe les plus courants (SecLists, `Pwdb_top-10000.txt`),
 * en minuscules. Chargés une seule fois, à l'évaluation du module.
 */
const COMMON_PASSWORDS: ReadonlySet<string> = loadCommonPasswords();

function loadCommonPasswords(): ReadonlySet<string> {
  const text = readFileSync(new URL('./common-passwords.txt', import.meta.url), 'utf8');
  const normalized = text.split(/\r?\n/).flatMap((line) => {
    const password = line.trim().toLowerCase();
    return password.length > 0 ? [password] : [];
  });
  return new Set(normalized);
}

/** Comparaison insensible à la casse avec la liste embarquée. */
export function isCommonPassword(pw: string): boolean {
  return COMMON_PASSWORDS.has(pw.toLowerCase());
}

/** Mot de passe refusé parce qu'il figure dans la liste des mots courants (F-90). */
export class PasswordTooCommonError extends Error {
  readonly code = 'PASSWORD_TOO_COMMON' as const;

  constructor() {
    super('Mot de passe trop courant');
    this.name = 'PasswordTooCommonError';
  }
}

/** Applique `PasswordSchema`, puis refuse un mot de passe courant. */
export function validateNewPassword(pw: string): void {
  PasswordSchema.parse(pw);
  if (isCommonPassword(pw)) {
    throw new PasswordTooCommonError();
  }
}

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2Hash(password, ARGON2ID_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2Verify(passwordHash, password);
  }
}
