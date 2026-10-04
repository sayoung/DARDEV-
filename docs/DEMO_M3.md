# Démo M3 — Documentation

Ce document décrit la procédure pour tester le jalon M3.

## Prérequis

1. **Services de développement** : PostgreSQL, Redis, MinIO et Mailpit doivent être joignables par le tunnel SSH sur `localhost`. **Ne PAS lancer `docker` ni `docker compose`.**
2. **Base de données** : Appliquez les migrations et insérez les données de démonstration :
   ```powershell
   pnpm db:migrate
   pnpm db:seed
   ```
3. **Variables d'environnement** : Assurez-vous que le fichier `.env` est configuré avec les variables `MEDIA_PUBLIC_URL` et `PUBLIC_WEB_URL` (voir `.env.example`).
   - *Astuce pour mobile* : Pour tester sur un téléphone connecté au même réseau, remplacez `localhost` par l'IP locale de votre poste (obtenue via la commande PowerShell `ipconfig` ou `Get-NetIPAddress`) dans `MEDIA_PUBLIC_URL` et `PUBLIC_WEB_URL`.

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

