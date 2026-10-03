# Démo M2 — Pipeline médias

Ce document décrit la procédure pour tester le pipeline d'importation et de traitement des panoramas (jalon M2).
**Rappel important :** Les images de test (CC0, Poly Haven, voir `CREDITS.txt` du dossier) ne doivent **jamais** être copiées dans le dépôt.

## Prérequis

1. **Docker Desktop** doit être démarré.
2. Démarrez les services de l'infrastructure (PostgreSQL, Redis, MinIO, Mailpit) :
   ```powershell
   docker compose up -d
   ```
3. Assurez-vous que la base de données est à jour et que les données de démonstration sont présentes :
   ```powershell
   pnpm db:migrate
   pnpm db:seed
   ```
4. Assurez-vous que le fichier `.env` a été copié depuis `.env.example` et contient la variable `SEED_DEFAULT_PASSWORD` (valeur de développement local uniquement).

## Étapes de la démonstration

1. Démarrez l'API et le Worker dans un premier terminal. Vous pouvez lancer tous les services avec `pnpm dev` (ou utiliser les filtres `api` et `worker`) :
   ```powershell
   pnpm dev
   ```

2. Dans un second terminal, définissez les variables `XPLOR_DEMO_PANOS` et `XPLOR_API_URL`, puis lancez `pnpm demo:m2`.

   **Sous Windows (PowerShell) :**
   ```powershell
   $env:XPLOR_DEMO_PANOS = 'D:/DARDEV/local/xplor-panoramas-test'
   $env:XPLOR_API_URL = 'http://localhost:3000'
   pnpm demo:m2
   ```

   **Sous environnement POSIX (bash) :**
   ```bash
   XPLOR_DEMO_PANOS=/chemin/vers/xplor-panoramas-test XPLOR_API_URL=http://localhost:3000 pnpm demo:m2
   ```

## Résultat attendu

Le script va soumettre les panoramas à l'API et attendre que le Worker les traite.

- **Succès :** Tous les panoramas valides doivent obtenir le statut `READY`.
- **Échec contrôlé :** Les fichiers commençant par `invalide_*` doivent obtenir le statut `ERROR` (ce qui correspond à l'état `ProcessingStatus.ERROR`, il n'y a pas de statut `FAILED`).
- **Code de sortie :**
  - **`0`** : Si le comportement est correct (tous les panoramas valides sont en `READY`, et les invalides en `ERROR`).
  - **`1`** : Si un panorama valide n'est pas en `READY` ou si un fichier `invalide_*` passe en `READY`.

## Résultat du 03/10/2026

| fichier | dimensions | status | durée | raison |
|---|---|---|---|---|
| acoustical_shell.jpg | 8192x4096 | READY | 6s | - |
| altanka.jpg | 8192x4096 | READY | 2s | - |
| amphitheatre_zanzibar_fort.jpg | 8192x4096 | READY | 4s | - |
| balcony.jpg | 8192x4096 | READY | 2s | - |
| beach_parking.jpg | 8192x4096 | READY | 2s | - |
| belvedere.jpg | 8192x4096 | READY | 2s | - |
| bloem_olive_house.jpg | 8192x4096 | READY | 4s | - |
| castel_st_angelo_roof.jpg | 8192x4096 | READY | 4s | - |
| entrance_hall.jpg | 8192x4096 | READY | 2s | - |
| hotel_room.jpg | 8192x4096 | READY | 2s | - |

*(Le dossier de test ne contient aucun fichier invalide_*, ils ne figurent donc pas dans ce tableau avec le statut ERROR)*

Code de sortie : 0

## Retraitement (F-12)

Pour tester la fonctionnalité de retraitement des panoramas en erreur ou déjà traités (sans avoir à les re-téléverser) :

1. Relancer un panorama spécifique (valide et en statut READY ou ERROR) :
   ```powershell
   pnpm --filter api cli reprocess --asset=01a102a9-bdd0-7e43-bccc-03c00d495cc4
   ```
   **Résultat attendu :**
   ```text
   [Nest] LOG [CLI] Relance du panorama 01a102a9-bdd0-7e43-bccc-03c00d495cc4...
   [Nest] LOG [CLI] Panorama 01a102a9-bdd0-7e43-bccc-03c00d495cc4 mis en file d'attente avec succès.
   ```
   Le panorama repasse temporairement à PROCESSING puis revient à READY.

2. Relancer tous les panoramas READY ou ERROR (utile après une mise à jour de l'algorithme) :
   ```powershell
   pnpm --filter api cli reprocess --all
   ```
   **Résultat attendu :**
   ```text
   [Nest] LOG [CLI] Relance de tous les panoramas READY ou ERROR...
   [Nest] LOG [CLI] 10 panorama(s) mis en file d'attente avec succès.
   ```

3. Gérer les erreurs (UUID inexistant ou arguments manquants) :
   - UUID inexistant :
     ```powershell
     pnpm --filter api cli reprocess --asset=01a102a9-0000-0000-0000-000000000000
     ```
     **Résultat attendu (code 1) :** `[Nest] ERROR [CLI] Erreur: Ce média est inconnu.`
     
   - Aucun argument fourni :
     ```powershell
     pnpm --filter api cli reprocess
     ```
     **Résultat attendu (code 1) :** `[Nest] ERROR [CLI] Une option est requise : fournissez --all ou --asset=<uuid>.`
