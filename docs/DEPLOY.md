# Déploiement de Xplor en Production (VPS)

Ce document décrit la procédure de déploiement de la plateforme Xplor sur le VPS de production.

## 1. Prérequis du VPS

Le VPS (IP: 187.7.31.208) doit déjà respecter les prérequis suivants :
- Un utilisateur `xplor`.
- Docker et Docker Compose installés.
- Les enregistrements DNS de type A pour les sous-domaines suivants pointent déjà vers l'IP du VPS :
  - `api.xplor.ma`
  - `admin.xplor.ma`
  - `v.xplor.ma`
  - `media.xplor.ma`
  - `demo.xplor.ma`

## 2. Séparation stricte avec le développement

**IMPORTANT :** La production est strictement séparée des services de développement.
Les services de développement (Postgres, Redis, MinIO, Mailpit sur `127.0.0.1` du VPS) ne doivent **JAMAIS** être réutilisés ni modifiés par la production. La production utilise ses propres conteneurs, ses propres volumes isolés, ses propres mots de passe et une base de données distincte (`xplor_prod`).

## 3. Configuration de l'environnement

À la racine du projet, copiez le modèle d'environnement pour créer la configuration de production :
```bash
cp .env.production.example .env.production
```

Éditez le fichier `.env.production` et remplacez toutes les valeurs par défaut (ou `CHANGER_MOI`) par de vrais secrets de production. Ne placez jamais de vrais secrets dans le dépôt de code.

- **Variables importantes à renseigner :**
  - **`ACME_EMAIL`** : L'adresse e-mail utilisée pour générer les certificats TLS via Let's Encrypt.
  - **`SEED_DEFAULT_PASSWORD`** : Le mot de passe (à définir avec une valeur sécurisée) qui sera utilisé pour le compte administrateur lors de l'initialisation de la base de données.

Vous pouvez générer des secrets forts pour les mots de passe et jetons via la commande :
```bash
openssl rand -base64 32
```

## 4. Migration de l'ancien site de démonstration (xplor-demo-web)

Le site `demo.xplor.ma` est actuellement servi par un conteneur Caddy autonome (`xplor-demo-web`). Le nouveau routeur Caddy de la production reprendra ce site via le répertoire défini par `DEMO_SITE_DIR`.

Avant de lancer le déploiement, suivez ces étapes :

1. Repérez le dossier contenant les fichiers du site de démo monté dans le conteneur actuel :
   ```bash
   docker inspect xplor-demo-web --format '{{ json .Mounts }}'
   ```
2. Renseignez ce chemin (par défaut `/var/www/demo`) dans la variable `DEMO_SITE_DIR` du fichier `.env.production`.
3. Vérifiez sur le serveur que ce dossier contient bien les fichiers du site `demo.xplor.ma`.
4. Arrêtez l'ancien Caddy pour libérer les ports (ne faites qu'un `stop` afin de le garder pour un éventuel retour en arrière, il sera supprimé après validation) :
   ```bash
   docker stop xplor-demo-web
   ```
5. Vérifiez ensuite que les ports 80 et 443 sont libres :
   ```bash
   netstat -tulpn | grep -E ':(80|443)'
   ```

## 5. Premier déploiement

Exécutez le script de déploiement depuis la racine du dépôt. Lors du tout premier déploiement, ajoutez l'option `--seed` pour initialiser la base de données avec le compte administrateur par défaut :
```bash
./deploy/deploy.sh --seed
```
Ce script validera la présence du fichier `.env.production`, construira les images nécessaires, appliquera les migrations Prisma, injectera les données (seed) et démarrera l'ensemble des conteneurs isolés de la production.

**Compte d'accès initial :**
Le paramètre `--seed` crée un compte d'administration avec les identifiants suivants :
- Identifiant / Email : `admin@xplor.local`
- Mot de passe : La valeur que vous avez définie dans `SEED_DEFAULT_PASSWORD`.

## 6. Vérifications post-déploiement

Une fois le déploiement terminé avec succès, effectuez les vérifications suivantes :

1. Vérifiez que l'API est en bonne santé en inspectant les en-têtes HTTP (doit répondre 200 OK) :
   ```bash
   curl -I https://api.xplor.ma/api/health
   ```
2. Ouvrez le back-office dans votre navigateur et vérifiez que la page de connexion s'affiche correctement :
   [https://admin.xplor.ma](https://admin.xplor.ma)
3. Connectez-vous avec l'e-mail `admin@xplor.local` et le mot de passe défini dans `SEED_DEFAULT_PASSWORD`.
4. Vérifiez également l'accessibilité des autres services configurés, comme le site de démo :
   [https://demo.xplor.ma](https://demo.xplor.ma)
