# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** NF-06 — paquet `@xplor/i18n` (fr / ar / en) et contrôle de complétude des clés.

Plan, avant code :

1. Créer `packages/i18n` (`@xplor/i18n`) avec `src/locales/fr.json`, `ar.json` et `en.json` : premières clés du back-office (`common.appName`, `auth.login.*`, `auth.logout`, `health.ok`).
2. Exporter `resources`, `isRtl(lang)` (vrai seulement pour `ar`) et `dir(lang)` (`rtl` ou `ltr`). Le type `Lang` vient de `@xplor/shared`.
3. Ajouter `packages/i18n` au workspace Vitest et le test `src/keys.test.ts` : aplatir les clés des trois fichiers, échouer si une clé manque ou si une valeur est vide, message listant les clés fautives.
4. Vérifier `pnpm test`, puis retirer une clé de `ar.json` pour confirmer l'échec, et la rétablir.
5. Pas de nouveau paquet npm (i18next attend le back-office). Le commit demandé est laissé à l'orchestrateur.

Hors de cette session : Docker Compose, NestJS, Prisma, squelettes d'applications, CI, authentification, RTL des écrans (pas encore d'UI).

Session précédente (NF-08) : ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`).

Réalisé :

- `packages/i18n` (`@xplor/i18n`) : `resources` (fr / ar / en), `isRtl` (vrai seulement pour `ar`), `dir` (`rtl` ou `ltr`). Type `Lang` importé de `@xplor/shared`.
- Clés du back-office : `common.appName`, `auth.login.title`, `auth.login.email`, `auth.login.password`, `auth.login.submit`, `auth.login.error`, `auth.logout`, `health.ok`.
- `packages/i18n/src/keys.test.ts` aplatit les trois fichiers et échoue en listant les clés manquantes ou vides. Vérifié : retirer `auth.logout` de `ar.json` fait échouer le test avec `ar: auth.logout (manquante)` ; clé rétablie, suite verte (7 tests).
- `pnpm lint` et `pnpm typecheck` passent (Node 22.23.3, pnpm 9.15.9). Forme des ressources consignée en D-30 (i18next non ajouté).
- Commit non créé : l'orchestrateur gère git. Message prévu : `M0 NF-06: packages/i18n fr/ar/en et contrôle de complétude des clés`.

## Tableau

| État | Détail |
|---|---|
| Fait | NF-09 (amorce) : squelette monorepo pnpm, fichiers de suivi, `pnpm install` vert. NF-08 (qualité) : ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests. NF-06 (paquet) : `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés. |
| En cours | M0 — Socle. Reste de NF-09 (Docker Compose, `db:migrate`, `db:seed`), reste de NF-06 (RTL des écrans et aucune chaîne en dur — pas encore d'interface), reste de NF-08 (architecture NestJS, configuration Zod au démarrage, couverture ≥ 70 % sur les modules métier — pas encore de code applicatif), F-90 (sans 2FA). |
| Bloqué | — |
| Risques | Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm). ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, mais exigés par NF-08. Docker, Prisma et les applications ne sont pas encore là. |
