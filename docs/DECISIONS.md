# Décisions — Xplor

Décisions reprises du cahier des charges v2.0 (section 11.1), plus D-28 propre à ce dépôt. « À valider : non » signifie que le porteur a déjà tranché, ou que la consigne de lancement du dépôt l'impose.

## D-03 — Langues

- **Date :** validée en v1.0, consignée ici le 29/09/2026
- **Décision :** français (langue par défaut), arabe (RTL), anglais.
- **Alternatives :** français seul ; ajout d'autres langues dès la phase 1.
- **À valider :** non

## D-04 — Partenaires

- **Date :** validée en v1.0, consignée ici le 29/09/2026
- **Décision :** les partenaires (SMIT, ministères) ne voient que des statistiques agrégées, jamais par hôtel.
- **Alternatives :** statistiques détaillées par hôtel pour les partenaires.
- **À valider :** non

## D-05 — Partage public

- **Date :** validée en v1.0, consignée ici le 29/09/2026
- **Décision :** `publicShare` à `false` par défaut : une visite n'est accessible sur le web que si le partage est activé.
- **Alternatives :** partage public dès la création.
- **À valider :** non

## D-26 — Création en brouillon

- **Date :** validée en v1.0, consignée ici le 29/09/2026
- **Décision :** les visites, scènes et hôtels sont créés en brouillon.
- **Alternatives :** création directement publiée.
- **À valider :** non

## D-27 — Pile Node.js / TypeScript

- **Date :** 29/09/2026
- **Décision :** abandon de Drupal 11 au profit de Node.js / TypeScript (NestJS + PostgreSQL + Prisma + React pour le back-office). Le code Drupal de M0 et M1 est archivé (branche ou dossier `legacy-drupal/`, non maintenu) ; M0 et M1 sont refaits sur la nouvelle pile. Les scénarios déjà validés (« Visite manuelle » Porte / Jardin / Remparts, démo Kasbah des Oudayas / Jardin de Salé / Plage de Mehdia) sont repris comme critères d'acceptation et données de seed.
- **Alternatives :** poursuivre Drupal 11.
- **À valider :** non

## D-28 — Démarrage du dépôt xplor_smit

- **Date :** 29/09/2026
- **Décision :** dépôt xplor_smit démarré directement sur la pile Node.js v2.0 ; code Drupal conservé hors dépôt dans `D:\DARDEV\local\xplor`, non maintenu.
- **Alternatives :** archiver le code Drupal dans ce dépôt (`legacy-drupal/` ou branche `legacy-drupal`).
- **À valider :** non

## D-29 — Dépendances de validation et de qualité (NF-08)

- **Date :** 29/09/2026
- **Décision :** outillage de qualité à la racine et schémas partagés dans `@xplor/shared`. Versions majeures tenues à ce que demandent NF-08 et la section 4.1 du cahier : ESLint 9 (le registre npm propose déjà la 10), TypeScript 5 (la 7 est publiée, et `typescript-eslint` 8 n'accepte pas TypeScript ≥ 6.1), Vitest 3 (dernière majeure qui charge encore `vitest.workspace.ts`).
- **Alternatives :** prendre les dernières majeures du registre (ESLint 10, TypeScript 7, Vitest 5) et remplacer `vitest.workspace.ts` par `test.projects`.
- **À valider :** non

| Paquet | Raison | Licence |
|---|---|---|
| zod | Schémas de validation partagés entre l'API et les fronts (`LocalizedTextSchema`, langues). | MIT |
| eslint | Analyse statique ESLint 9, configuration plate `eslint.config.mjs`. | MIT |
| @eslint/js | Règles recommandées ESLint, socle de la config plate. | MIT |
| typescript-eslint | Règles TypeScript en mode `strict-type-checked`, dont `@typescript-eslint/no-explicit-any` en erreur. | MIT |
| prettier | Formatage commun (`.prettierrc`, `.prettierignore`). | MIT |
| vitest | Tests unitaires, fichier de workspace `vitest.workspace.ts`. | MIT |
| typescript | `tsc --noEmit`, TypeScript 5 imposé par la pile. | Apache-2.0 |

## Encore à valider (cahier des charges, section 11.2)

Pas de numéro de décision tant que le porteur n'a pas tranché :

1. Matériel des kiosques : mini-PC + écran tactile 32" et/ou casque autonome (Meta Quest 3 / Pico 4).
2. Hébergement : VPS au Maroc ou cloud international ; stockage S3 (MinIO auto-hébergé ou service géré). Impact loi 09-08 et coût.
3. Nombre de visites prévues au lancement et liste des sites de la région Rabat-Salé-Kénitra.
4. Nom de domaine et charte graphique Xplor.
