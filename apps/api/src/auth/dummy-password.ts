/**
 * Hash argon2id précalculé, mêmes coûts que `PasswordService` (19 456 Kio, 2 passes, 1 fil).
 * Vérifié quand l'email est inconnu, pour ne pas révéler l'existence du compte par le temps de réponse.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$YfjHCzRM7nW2MD95tIZS+A$3z5fNdO69RXd0HnpVQvy3qqe68L9zgaw/RmdcMJk3bk';
