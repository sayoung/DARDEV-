# Démo M3 — Documentation

Ce document décrit la procédure pour tester le jalon M3.

## Prérequis

1. **Services de développement** : PostgreSQL, Redis, MinIO et Mailpit doivent être joignables par le tunnel SSH sur `localhost`. **Ne PAS lancer `docker` ni `docker compose`.**
2. **Base de données** : Appliquez les migrations et insérez les données de démonstration :
   ```powershell
   pnpm db:migrate
   pnpm db:seed
   ```
3. **Variables d'environnement** : Assurez-vous que les fichiers `.env` sont configurés avec les variables suivantes (voir `.env.example`) :
   - `MEDIA_PUBLIC_URL=http://localhost:9000/xplor`
   - `PUBLIC_WEB_URL=http://localhost:5174`
   - `VITE_PUBLIC_WEB_URL=http://localhost:5174` (dans `apps/admin/.env` ou `.env` à la racine)

> **Limite / risque** : MinIO, Postgres et Redis tournent sur le VPS derrière un tunnel SSH et ne répondent que sur le `localhost` du poste de développement. Un mobile distant ne peut donc pas joindre MinIO via l'IP du poste sans redirection de port supplémentaire. Les panoramas ne se chargeront pas forcément sur mobile.
> *Astuce pour mobile (optionnelle et non garantie)* : Pour tester sur un téléphone connecté au même réseau, remplacez `localhost` par l'IP locale de votre poste (obtenue via la commande PowerShell `ipconfig`) dans `MEDIA_PUBLIC_URL`, `PUBLIC_WEB_URL` et `VITE_PUBLIC_WEB_URL`.

## Démarrage

Lancez tous les services en parallèle :

```powershell
pnpm dev
```

Les applications seront disponibles aux adresses suivantes :
- **API** : http://localhost:3000
- **Admin (Back-office)** : http://localhost:5173
- **Web (Plateforme publique)** : http://localhost:5174

## Scénario

### 1. Partage et QR code (Back-office)

Cette étape permet de vérifier la génération du QR code de partage pour une visite publiée. La condition d'affichage du QR code exige que la visite ait le statut `PUBLISHED` et que le partage soit actif.

1. Ouvrez l'application Admin (Back-office) à l'adresse http://localhost:5173.
2. Sur l'écran **Connexion**, connectez-vous avec un compte du seed :
   - E-mail : `admin@xplor.local`
   - Mot de passe : `xplor-seed-dev-2026`
3. Dans la liste des visites, ouvrez la visite de Rabat (**Kasbah des Oudayas**).
4. Défilez vers le panneau de publication. La visite est publiée et son partage est actif. Le slug du jeton de partage est `demo-rabat`.
5. Vérifiez qu'un encadré intitulé **QR code de la visite** s'affiche.
6. Cliquez sur le bouton **Télécharger le QR code** pour enregistrer le fichier au format SVG.
