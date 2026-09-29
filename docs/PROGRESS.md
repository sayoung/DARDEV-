# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** NF-08 — qualité du code à la racine et `packages/shared`.

Plan, avant code :

1. ESLint 9 en config plate (`eslint.config.mjs`), `typescript-eslint` en mode `strict-type-checked`, règle `@typescript-eslint/no-explicit-any` en erreur.
2. Prettier (`.prettierrc`, `.prettierignore`) et Vitest (`vitest.workspace.ts`).
3. Créer `packages/shared` (`@xplor/shared`) : enum `Role`, `LANGS` / `Lang`, `LocalizedTextSchema`, `localize` (repli sur `fr`).
4. Tests Vitest dans `packages/shared/src/localized-text.test.ts` : français obligatoire, repli ar→fr, chaîne vide traitée comme absente, langue inconnue refusée.
5. Inscrire zod, eslint, typescript-eslint, prettier et vitest dans `docs/DECISIONS.md`.
6. Vérifier `pnpm lint`, `pnpm typecheck` et `pnpm test`.

Hors de cette session : Docker Compose, NestJS, Prisma, squelettes d'applications, CI, authentification. Le commit demandé est laissé à l'orchestrateur.

Session précédente (NF-09, amorce) : squelette monorepo en place, `pnpm install` vert.

Réalisé :

- ESLint 9 (`eslint.config.mjs`, `typescript-eslint` en `strict-type-checked`, `@typescript-eslint/no-explicit-any` en erreur), Prettier (`.prettierrc`, `.prettierignore`), Vitest 3 (`vitest.workspace.ts`).
- `packages/shared` (`@xplor/shared`) : `Role`, `LANGS` / `Lang`, `LocalizedTextSchema`, `localize`. Tests dans `packages/shared/src/localized-text.test.ts` (4 tests verts).
- Dépendances inscrites en D-29. `skipLibCheck` ajouté à `tsconfig.base.json` pour que `tsc` ne typecheck pas les `.d.ts` des dépendances.
- Vérification (Node 22.23.3, pnpm 9.15.9) : `pnpm lint`, `pnpm typecheck` et `pnpm test` passent. Vitest affiche un avertissement : le fichier workspace est déprécié et disparaît à la majeure suivante.
- Commit non créé : l'orchestrateur gère git. Message prévu : `M0 NF-08: ESLint/Prettier/Vitest et packages/shared (Role, LocalizedText)`.

## Tableau

| État | Détail |
|---|---|
| Fait | NF-09 (amorce) : squelette monorepo pnpm, fichiers de suivi, `pnpm install` vert. NF-08 (qualité) : ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests. |
| En cours | M0 — Socle. Reste de NF-09 (Docker Compose, `db:migrate`, `db:seed`), NF-06, reste de NF-08 (architecture NestJS, configuration Zod au démarrage, couverture ≥ 70 % sur les modules métier — pas encore de code applicatif), F-90 (sans 2FA). |
| Bloqué | — |
| Risques | Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm). ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, mais exigés par NF-08. Docker, Prisma et les applications ne sont pas encore là. |
