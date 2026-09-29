# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** NF-09 (amorce) — squelette du monorepo pnpm et suivi du projet.

Plan, avant code :

1. Confirmer la branche `develop` créée à partir de `main`.
2. Poser le squelette à la racine : `package.json` privé (pnpm 9.x, Node `>=22 <23`), scripts délégués aux workspaces, `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `.gitignore`, `.env.example`, `tsconfig.base.json`.
3. Copier `AGENTS.md` et `CAHIER_DES_CHARGES_XPLOR.md` à la racine.
4. Ouvrir `docs/DECISIONS.md` (D-03, D-04, D-05, D-26, D-27, D-28).
5. Vérifier `pnpm install` et l'absence de fichier `.env` dans `git status`.

Hors de cette session : Docker Compose, NestJS, Prisma, squelettes d'applications, CI, authentification.

Réalisé :

- `develop` pointe déjà sur le même commit que `main` (`965d1ec`, « Initialiser le dépôt du projet. ») : pas de nouvelle branche à créer.
- Squelette posé : `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `.gitignore`, `.env.example`, `tsconfig.base.json`, `pnpm-lock.yaml`.
- `AGENTS.md` et `CAHIER_DES_CHARGES_XPLOR.md` copiés à la racine.
- `docs/DECISIONS.md` ouvert (D-03 à D-05, D-26, D-27, D-28).
- Vérification : `pnpm install` (pnpm 9.15.9, Node 22.23.3) se termine sans erreur. `git status` ne liste aucun fichier `.env` (`.env.example` reste suivi).

## Tableau

| État | Détail |
|---|---|
| Fait | NF-09 (amorce) : squelette monorepo pnpm, fichiers de suivi, `pnpm install` vert. |
| En cours | M0 — Socle. Reste de NF-09 (Docker Compose, `db:migrate`, `db:seed`), NF-06, NF-08, F-90 (sans 2FA). |
| Bloqué | — |
| Risques | Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm). Docker, Prisma et les applications ne sont pas encore là : les quatre commandes d'un environnement complet ne suffisent pas encore. |
