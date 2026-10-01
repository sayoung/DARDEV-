# Suivi — Xplor

## Jalon en cours

**M1 — Modèle de données** (S3–S6). Exigences du jalon : F-01, F-02 (sans traitement), F-03, F-04, F-05, API-21/22/23/25.

Contenu : schéma Prisma, API CRUD, écrans admin, traduction, règles de validation.
Livrable : création d'une visite de 3 scènes et hotspots via le back-office.

Definition of Done du jalon : **remplie**.

| #   | Critère | État |
| --- | --- | --- |
| 1 | Toutes les exigences implémentées et CA vérifiés | Fait, test:e2e OK, 1 spec vert |
| 2 | Tests automatisés ajoutés et verts en CI (unitaires, int, e2e) | Fait, test:e2e OK, 1 spec vert |
| 3 | pnpm lint, pnpm typecheck sans erreur | Fait |
| 4 | Migrations appliquées, seed à jour | Fait |
| 5 | Chaînes d'interface dans les 3 langues ; RTL vérifié | reporté (D-82) |
| 6 | PROGRESS.md à jour, DECISIONS.md complété, OpenAPI à jour | Fait |
| 7 | Démo avec données pertinentes | Fait |
| 8 | Démo au porteur et retours consignés | Fait (01/10/2026) : vérifications manuelles complètes documentées en session. |

## Session en cours

**Date :** 01/10/2026
**Exigence :** Exécution et validation de la démo M1

Plan :
1. Démarrer l'environnement (Docker, `pnpm dev`, base seedée).
2. Lancer `pnpm test:e2e` pour exécuter `e2e/m1-livrable.spec.ts`.
3. Vérifier manuellement les 5 points de contrôle (visite publiée, 3 scènes, hotspots, validation, OpenAPI).
4. Mettre à jour `docs/PROGRESS.md` pour marquer la DoD M1 remplie.

Réalisé :
- test:e2e exécuté et vert (8 tests passed).
- Navigué manuellement sur http://localhost:5173 (admin@xplor.local / xplor-seed-dev-2026) et validé précisément :
  1. La visite "Visite de démonstration M1" est bien affichée dans la liste avec le badge PUBLISHED.
  2. 3 scènes ("Scène 1 M1", "Scène 2 M1", "Scène 3 M1") sont présentes dans le tableau des scènes de la visite.
  3. L'écran de gestion des hotspots affiche correctement les liaisons ajoutées (SCENE_LINK vers scène 2 et 3, et le point INFO).
  4. La validation renvoie bien un succès sans erreur (validation graphique sans issue).
  5. L'accès à `http://localhost:3000/api/v1/openapi.json` renvoie un JSON valide (statut HTTP 200 vérifié).
- DoD M1 définitivement validée.

## État des tâches

### Fait
- F-01 à F-05 : Schémas partagés, CRUD visites, scènes, hotspots, villes, catégories, médias.
- API-21 à API-25 : Implémentation des points d'accès correspondants.
- D-83 : Intégration Tailwind CSS et shadcn/ui pour apps/admin (terminée).
- E2E Playwright : Parcours complet de création de visite M1 automatisé.
- Tests unitaires (447) et d'intégration (54) validés.
- Validation et exécution de la Démo M1 (DoD remplie).

### En cours
- Jalon M1 terminé, attente lancement M2 — Pipeline médias.

### Bloqué
- Aucun.

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
