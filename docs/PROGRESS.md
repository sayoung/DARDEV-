# Suivi — Xplor

## Jalon en cours

**M1 — Modèle de données** (S3–S6). Exigences du jalon : F-01, F-02 (sans traitement), F-03, F-04, F-05, API-21/22/23/25.

Contenu : schéma Prisma, API CRUD, écrans admin, traduction, règles de validation.
Livrable : création d'une visite de 3 scènes et hotspots via le back-office.

Definition of Done du jalon : **non remplie** (démo restante).

| #   | Critère | État |
| --- | --- | --- |
| 1 | Toutes les exigences implémentées et CA vérifiés | Fait |
| 2 | Tests automatisés ajoutés et verts en CI (unitaires, int, e2e) | Fait |
| 3 | pnpm lint, pnpm typecheck sans erreur | Fait |
| 4 | Migrations appliquées, seed à jour | Fait |
| 5 | Chaînes d'interface dans les 3 langues ; RTL vérifié | reporté (D-82) |
| 6 | PROGRESS.md à jour, DECISIONS.md complété, OpenAPI à jour | Fait |
| 7 | Démo avec données pertinentes | Fait |
| 8 | Démo au porteur et retours consignés | à faire |

## Session en cours

**Date :** 01/10/2026
**Exigence :** M1 Playwright (livrable) : créer `e2e/m1-livrable.spec.ts`

Plan :
1. Corriger le lint dans le test (`String(i)`).
2. Supprimer les fichiers PNG à la racine.
3. Retirer les modifications hors-scope de `HotspotForm.tsx`.
4. Utiliser des locators robustes (`data-testid`) dans le test et composants.
5. Exécuter `pnpm test:e2e` pour vérifier.

Réalisé :
- lint, typecheck, test OK.

## État des tâches

### Fait
- F-01 à F-05 : Schémas partagés, CRUD visites, scènes, hotspots, villes, catégories, médias.
- API-21 à API-25 : Implémentation des points d'accès correspondants.
- D-83 : Intégration Tailwind CSS et shadcn/ui pour apps/admin (terminée).
- E2E Playwright : Parcours complet de création de visite M1 automatisé.

### En cours
- validation finale de la DoD par le porteur (démo).

### Bloqué
- Aucun.

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).


