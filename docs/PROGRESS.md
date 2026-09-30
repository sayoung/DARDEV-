# Suivi — Xplor

## Jalon en cours

**M1 — Modèle de données** (S3–S6). Exigences du jalon : F-01, F-02 (sans traitement), F-03, F-04, F-05, API-21/22/23/25.

Contenu (cahier des charges, section 9) : schéma Prisma 5.1 à 5.8, API-21/22/23/25 (CRUD), écrans admin de liste et de formulaire, onglets de traduction, règles de validation. Livrable : création d'une visite de 3 scènes et hotspots (coordonnées saisies à la main) via le back-office.

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 30/09/2026
**Exigence :** Intégration Tailwind CSS et shadcn/ui pour apps/admin (D-83)

Plan :
1. Installer Tailwind CSS et shadcn/ui. Inscrire les dépendances dans docs/DECISIONS.md.
2. Créer une mise en page commune (barre latérale, en-tête avec utilsateur/langue/déconnexion, zone contenu) RTL ready.
3. Appliquer composants (tables, formulaires, boutons, badges, onglets, alertes) aux écrans existants.
4. Accueil : tableau de bord (nombre de visites, scènes, brouillons/publiées, raccourcis).
5. Corriger le doublon « Administrateur ».
6. Valider avec lint, typecheck, test (sans casser les tests existants).

Réalisé (30/09/2026) :
- lint, typecheck, test OK. Aucun commit (orchestrateur).

## Definition of Done — M1

Cahier des charges, section 10. Definition of Done du jalon : **non remplie**.

| #   | Critère                                                                                                                                                                                               | État    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Toutes les exigences du jalon implémentées et leurs CA vérifiés.                                                                                                                                      | à faire |
| 2   | Tests automatisés ajoutés et verts en CI (Vitest unitaires + intégration API, Playwright pour les parcours principaux).                                                                               | à faire |
| 3   | `pnpm lint`, `pnpm typecheck` sans erreur.                                                                                                                                                            | à faire |
| 4   | Migrations Prisma créées et appliquées sur une base vierge sans erreur ; seed à jour.                                                                                                                 | à faire |
| 5   | Chaînes d'interface dans les 3 langues ; vérification visuelle en arabe (RTL).                                                                                                                        | reporté, D-82 |
| 6   | `docs/PROGRESS.md` mis à jour (fait / reste / risques) ; `docs/DECISIONS.md` complété ; OpenAPI à jour si l'API a changé.                                                                             | à faire |
| 7   | Données de démonstration : `pnpm db:seed` crée 3 visites liées entre elles, 1 hôtel, 1 kiosque et un utilisateur par rôle (panoramas d'exemple libres de droits dans `apps/api/prisma/seed-assets/`). | Partiel |
| 8   | Démo au porteur effectuée et retours consignés.                                                                                                                                                       | à faire |

## Tableau

### Fait
- **F-01** (schémas Zod et modèle Prisma 5.1 à 5.5) : Schémas partagés et modèles créés. CRUD des visites, duplication, liste et formulaires implémentés.
- **API-21, partie 1** (CRUD des visites) : `GET` / `POST` / `PATCH` / `DELETE` implémentés et testés.
- **API-22, partie 1 & 2** (CRUD des scènes et ordonnancement) : `GET` / `POST` / `PATCH` / `DELETE` et routes `reorder`, `set-start` implémentées.
- **F-03** (règles de publication) : Affichage des problèmes réalisé via `TourPublicationPanel` et endpoints `validate`, `publish`, `unpublish` implémentés (D-74).
- **API-25** (CRUD villes et catégories) : Routes API et écrans back-office complétés et testés.
- **Schéma 5.6 à 5.8** : Modèles Hotel, Kiosk, Selection, UserHotel implémentés.
- **API-23** (Hotspots) : Contrats, liste, création, modification, suppression implémentées en API.
- **F-05** (liste des médias) : API de lecture seule et composant `AssetPicker` implémentés.
- **NF-09** (seed des 3 visites liées) : `seed-tours.ts` intégré et fonctionnel.
- **F-04** (onglets de traduction) : Composant `LocalizedTextField` fonctionnel, français obligatoire.

### En cours
- Intégration Tailwind CSS et shadcn/ui pour apps/admin (D-83) : installation, layout RTL, composants.
- Reste du jalon M1 : API-21 complet (share-token, qr.svg, graph, preview-token), écran admin des hotspots. F-02 (sans traitement). CRUD hôtel et kiosque (M5).

### Bloqué
- Aucun.

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur injoignable par moments, `VirtualMachinePlatform` actif mais `VirtualizationFirmwareEnabled` False).
- `eslint` 9 et `vitest.workspace.ts` dépréciés.
- Avis audit sous le seuil CI (Vitest 3.2.7, fastify 5.11.3).
