# Suivi — Xplor

## Jalon en cours

**M1 — Modèle de données** (S3–S6). Exigences du jalon : F-01, F-02 (sans traitement), F-03, F-04, F-05, API-21/22/23/25.

Contenu (cahier des charges, section 9) : schéma Prisma 5.1 à 5.8, API-21/22/23/25 (CRUD), écrans admin de liste et de formulaire, onglets de traduction, règles de validation. Livrable : création d'une visite de 3 scènes et hotspots (coordonnées saisies à la main) via le back-office.

Definition of Done du jalon : non remplie (Playwright et démo restants).

## Session en cours

**Date :** 30/09/2026
**Exigence :** Vérification DoD M1 avant Playwright

Plan :
1. Lancer les vérifications (`lint`, `typecheck`, `test`, `test:int`).
2. Vérifier `db:migrate` et `db:seed`.
3. Régénérer `docs/openapi.json`.
4. Mettre à jour `docs/PROGRESS.md` avec les résultats et enregistrer les décisions dans `docs/DECISIONS.md`.

Réalisé :
- lint et typecheck OK (aucune erreur).
- unit tests OK (447 tests passés).
- int tests OK (54 tests passés).
- migrations appliquées (Already in sync).
- seed créé (3 visites, 1 hôtel, 1 kiosque, 4 utilisateurs).
- openapi.json regénéré.
- PROGRESS.md et DECISIONS.md (D-83, D-82) à jour.

## Definition of Done — M1

Cahier des charges, section 10. Definition of Done du jalon : **non remplie**.

| #   | Critère                                                                                                                                                                                               | État    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Toutes les exigences du jalon implémentées et leurs CA vérifiés.                                                                                                                                      | Partiel (manque Playwright) |
| 2   | Tests automatisés ajoutés et verts en CI (Vitest unitaires + intégration API, Playwright pour les parcours principaux).                                                                               | Partiel (447 unitaires, 54 intégration, Playwright à faire) |
| 3   | pnpm lint, pnpm typecheck sans erreur.                                                                                                                                                            | Fait |
| 4   | Migrations Prisma créées et appliquées sur une base vierge sans erreur ; seed à jour.                                                                                                                 | Fait (Already in sync) |
| 5   | Chaînes d'interface dans les 3 langues ; vérification visuelle en arabe (RTL).                                                                                                                        | reporté, D-82 |
| 6   | docs/PROGRESS.md mis à jour (fait / reste / risques) ; docs/DECISIONS.md complété ; OpenAPI à jour si l'API a changé.                                                                             | Fait |
| 7   | Données de démonstration : pnpm db:seed crée 3 visites liées entre elles, 1 hôtel, 1 kiosque et un utilisateur par rôle.                                                                            | Fait |
| 8   | Démo au porteur effectuée et retours consignés.                                                                                                                                                       | à faire |

## Tableau

### Fait
- **F-01** : Schémas partagés, modèles. CRUD des visites, duplication, listes, formulaires.
- **API-21** (partiel) : GET / POST / PATCH / DELETE visites.
- **API-22** : CRUD scènes, ordonnancement, scène de départ.
- **F-03** : Règles de publication, TourPublicationPanel, API  alidate/publish/unpublish (D-74).
- **API-25** : CRUD villes et catégories.
- **Schémas** : Hotel, Kiosk, Selection, UserHotel.
- **API-23** : CRUD Hotspots en API + écran admin des hotspots.
- **F-05** : Médias API + AssetPicker.
- **NF-09** : Seed (3 visites liées).
- **F-04** : LocalizedTextField (français obligatoire).
- **D-83** : Intégration Tailwind CSS et shadcn/ui pour apps/admin (1/5 à 5/5) terminée.

### En cours
- parcours Playwright du livrable M1
- contrôle de la DoD

### Bloqué
- Aucun. (Le blocage concernant la fusion manquante a été résolu en récupérant les composants manquants).

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur injoignable par moments, VirtualMachinePlatform actif mais VirtualizationFirmwareEnabled False).
- eslint 9 et  itest.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest 3.2.7, fastify 5.11.3).

