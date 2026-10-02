# Suivi — Xplor

## Jalon en cours

**M2 — Pipeline 360 (S7–S10)**. Exigences : F-10, F-11, F-12, API-24.

Livrable : Upload de 10 panoramas Insta360 → tous READY.

| # | Critère | État |
|---|---|---|
| 1 | Toutes les exigences implémentées et CA vérifiés | à faire |
| 2 | Tests automatisés ajoutés et verts en CI (unitaires, int, e2e) | à faire |
| 3 | pnpm lint, pnpm typecheck sans erreur | à faire |
| 4 | Migrations appliquées, seed à jour | à faire |
| 5 | Chaînes d'interface dans les 3 langues ; RTL vérifié | reporté (D-82) |
| 6 | PROGRESS.md à jour, DECISIONS.md complété, OpenAPI à jour | à faire |
| 7 | Démo avec données pertinentes | à faire |
| 8 | Démo au porteur et retours consignés | à faire |

## Session en cours

**Date :** 02/10/2026
**Objectif :** Initialisation du jalon M2

Plan :
- Archiver l'état M1 dans docs/archive/PROGRESS-M1.md
- Mettre à jour docs/PROGRESS.md pour le jalon M2
- Vérifier lint, typecheck et tests

## État des tâches

### Fait
- M1 validé par le porteur le 01/10/2026, détail dans docs/archive/PROGRESS-M1.md.

### En cours
- Démarrage du jalon M2.

### Bloqué
- Aucun.

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
