# AGENTS.md — Règles de travail pour l'agent IA (projet Xplor)

La spécification de référence est `CAHIER_DES_CHARGES_XPLOR.md` (v2.0, pile Node.js / TypeScript). Ce fichier dit **comment** travailler.

## Démarrage de chaque session
1. Lire `docs/PROGRESS.md` (où en est-on) et `docs/DECISIONS.md` (ce qui a été tranché).
2. Identifier le jalon en cours (section 9 du cahier des charges) et les exigences restantes.
3. Écrire un court plan dans `docs/PROGRESS.md` (section « Session en cours ») avant de coder.

## Règles
- Un jalon à la fois, dans l'ordre. Ne pas développer ce qui est listé « Exclu de la phase 1 ».
- Commits petits et fréquents, message au format : `M3 F-32: navigation inter-visites avec pile d'historique`.
- Tests d'abord pour la logique métier (validation de graphe, `AccessPolicy`, manifeste, agrégation statistique).
- **Une seule source de vérité pour les types** : schémas Zod et types dans `packages/shared`, importés par l'API et les apps. Ne jamais redéclarer un type d'API côté front.
- API NestJS : contrôleur fin → service → Prisma. Toute route admin passe par le guard de session + CSRF + `AccessPolicy`. Pas de requête Prisma dans un contrôleur.
- Base de données : toute modification de schéma passe par `prisma migrate dev --name <description>`. Ne jamais éditer une migration déjà fusionnée.
- Front : TypeScript `strict`, pas d'`any` explicite. React uniquement dans `apps/admin` ; `packages/viewer-core`, `apps/web` et `apps/kiosk` restent sans framework.
- Chaque chaîne visible passe par `packages/i18n` (fr / ar / en). Vérifier l'arabe (RTL) ; utiliser les propriétés CSS logiques (`margin-inline-start`, etc.).
- Contrôle d'accès : chaque endpoint et chaque liste filtrée par hôtel a un test « un gestionnaire de l'hôtel A ne voit pas l'hôtel B ».
- Aucun secret, jeton ou mot de passe dans le dépôt (`.env` ignoré, `.env.example` tenu à jour). Aucune donnée personnelle de voyageur collectée.
- Dépendances : ne pas ajouter de paquet npm sans l'inscrire dans `docs/DECISIONS.md` (nom, raison, licence). Préférer les paquets maintenus et largement utilisés.

## Commandes de référence
```bash
docker compose up -d                 # postgres, redis, minio, mailpit
pnpm install
pnpm db:migrate                      # prisma migrate dev
pnpm db:seed                         # données de démonstration
pnpm dev                             # api + worker + admin + web + kiosk en parallèle
pnpm lint && pnpm typecheck
pnpm test                            # Vitest (unitaires + intégration API sur base de test)
pnpm test:e2e                        # Playwright
pnpm --filter api cli reprocess --all
```

## Fin de session
- Mettre à jour `docs/PROGRESS.md` : exigences terminées (avec ID), en cours, bloquées, risques.
- Toute hypothèse prise → `docs/DECISIONS.md` (date, décision, alternatives, à valider oui/non).
- Si la *Definition of Done* du jalon est remplie : l'indiquer et préparer le scénario de démo.

## Quand s'arrêter et demander
- Une exigence contredit une autre ou la loi 09-08.
- Une action est irréversible sur un environnement autre que local (déploiement, suppression de données).
- Un choix change le modèle de données après le jalon M1 de façon non rétrocompatible.
