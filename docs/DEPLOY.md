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
  - **`S3_PUBLIC_ENDPOINT`** : L'URL publique de MinIO (ex. `https://media.xplor.ma`) utilisée pour signer les URL de téléchargement et d'envoi de fichiers pour le navigateur.
  - **`SEED_DEFAULT_PASSWORD`** : Le mot de passe (à définir avec une valeur sécurisée) qui sera utilisé pour le compte administrateur lors de l'initialisation de la base de données.
  - **Mots de passe liés** : Le mot de passe de `DATABASE_URL` doit être identique à `POSTGRES_PASSWORD`, et `S3_ACCESS_KEY` / `S3_SECRET_KEY` doivent être identiques à `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (`minio-init` s'en sert comme compte admin).

Vous pouvez générer des secrets forts pour les mots de passe et jetons via la commande :
```bash
openssl rand -hex 24
```

## 4. Migration de l'ancien site de démonstration (xplor-demo-web)

Le site `demo.xplor.ma` est actuellement servi par un conteneur Caddy autonome (`xplor-demo-web`). Le nouveau routeur Caddy de la production reprendra ce site via le répertoire défini par `DEMO_SITE_DIR`.

Avant de lancer le déploiement, suivez ces étapes :

1. Repérez le dossier contenant les fichiers du site de démo monté dans le conteneur actuel :
   ```bash
   docker inspect xplor-demo-web --format '{{ json .Mounts }}'
   ```
2. Renseignez ce chemin (par défaut `/opt/xplor-demo` sur ce VPS) dans la variable `DEMO_SITE_DIR` du fichier `.env.production`.
3. Vérifiez sur le serveur que ce dossier contient bien les fichiers du site `demo.xplor.ma`.
4. Arrêtez l'ancien Caddy pour libérer les ports (ne faites qu'un `stop` afin de le garder pour un éventuel retour en arrière, il sera supprimé après validation) :
   ```bash
   docker stop xplor-demo-web
   ```
5. Vérifiez ensuite que les ports 80 et 443 sont libres :
   ```bash
   sudo ss -tulpn | grep -E ':(80|443)\b'
   ```

## 5. Premier déploiement

Assurez-vous d'abord que le dépôt de code a été cloné sur le VPS. Ensuite, exécutez le script de déploiement depuis la racine du dépôt. Lors du tout premier déploiement, ajoutez l'option `--seed` pour initialiser la base de données :
```bash
bash deploy/deploy.sh --seed
```
Ce script validera la présence du fichier `.env.production`, construira les images nécessaires, appliquera les migrations Prisma, injectera les données de démonstration (seed) et démarrera l'ensemble des conteneurs isolés de la production.

**Comptes et données initiaux :**
Le paramètre `--seed` crée des données de démonstration ainsi que les comptes suivants, utilisant tous le mot de passe défini dans `SEED_DEFAULT_PASSWORD` (qui doit faire au moins 12 caractères et ne pas être courant) :
- `admin@xplor.local` (Administrateur)
- `editor@xplor.local` (Éditeur)
- `manager@xplor.local` (Gestionnaire)
- `partner@xplor.local` (Partenaire)

*Note importante :* Après le premier déploiement, veillez à changer les mots de passe de ces comptes ou à désactiver les comptes non-administrateur qui ne sont pas nécessaires en production.

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

## 7. Mises à jour

Pour appliquer la dernière version de l'application :

1. Tirez les derniers changements depuis le dépôt :
   ```bash
   git pull
   ```
2. Relancez le script de déploiement :
   ```bash
   bash deploy/deploy.sh
   ```
Ce script validera l'environnement, construira ou téléchargera les nouvelles images, appliquera les éventuelles migrations Prisma et redémarrera les conteneurs sans temps d'arrêt prolongé.

## 8. Sauvegarde (Backup) quotidienne

Pour garantir la pérennité des données (base PostgreSQL et fichiers médias dans MinIO), une sauvegarde régulière est indispensable. Le script `bash deploy/backup.sh` génère un dossier horodaté de sauvegarde.

Ce dossier est créé par défaut dans `/var/backups/xplor/<horodatage>/` (modifiable via la variable `BACKUP_DIR` dans `.env.production`). Il contient deux fichiers :
- `db.dump` : la base de données PostgreSQL.
- `media.tar.gz` : l'archive des fichiers stockés dans MinIO.

Le script effectue automatiquement une rotation et supprime les dossiers de sauvegarde vieux de plus de 7 jours (`-mtime +7`).

Pour automatiser une sauvegarde quotidienne à 3h30 du matin, ajoutez la ligne suivante à la table de planification de l'utilisateur `xplor` (via `crontab -e`) :

```cron
30 3 * * * cd /opt/xplor && bash deploy/backup.sh >> /home/xplor/xplor-backup.log 2>&1
```

*Note :* Assurez-vous que le dossier de sauvegarde (`/var/backups/xplor` par défaut) et le fichier de log (`/home/xplor/xplor-backup.log`) sont accessibles en écriture par l'utilisateur `xplor`.

## 9. Restauration de la sauvegarde

En cas d'incident, utilisez le script `bash deploy/restore.sh` en lui passant le chemin du dossier de sauvegarde à restaurer :

```bash
bash deploy/restore.sh /var/backups/xplor/<horodatage>
```

Le script demandera de confirmer l'opération en tapant `OUI`. Vous pouvez contourner cette confirmation en ajoutant l'option `--yes` (utile pour l'automatisation) :
```bash
bash deploy/restore.sh /var/backups/xplor/<horodatage> --yes
```

Le script effectue les opérations suivantes :
1. Arrête les services `api` et `worker`.
2. Restaure la base de données via `pg_restore --clean --if-exists`.
3. Extrait l'archive `media.tar.gz` (si présente) directement dans le dossier `/data` de MinIO, sans purger les fichiers existants.
4. Redémarre les services `api` et `worker`.

**Recommandation de test :** Il est fortement recommandé d'exécuter un **test de restauration** régulièrement sur un environnement bac à sable distinct pour s'assurer que l'archive est intègre et que la procédure fonctionne.

## 10. Retour arrière (Rollback)

En cas de mise en production instable, vous pouvez restaurer une version précédente du code :

1. Revenez au commit fonctionnel (par exemple, via `git reset --hard <commit>` ou `git checkout <commit>`).
2. Relancez le script de déploiement :
   ```bash
   bash deploy/deploy.sh
   ```

*Attention :* Le script `deploy.sh` applique automatiquement les migrations de base de données (`prisma migrate deploy`). Un simple retour arrière du code ne défait **pas** les migrations. Si le code instable contenait des migrations modifiant le schéma, vous devrez potentiellement restaurer la dernière sauvegarde fonctionnelle de la base de données via `bash deploy/restore.sh /var/backups/xplor/<horodatage>` pour garantir la synchronisation entre le code et les données.

## 11. Dépannage

Pour diagnostiquer les erreurs en production, examinez les journaux (logs) des conteneurs via Docker Compose.

Par exemple, pour visualiser les journaux de l'API :
```bash
docker compose -f docker-compose.prod.yml logs api
```

**Problème de certificats HTTPS :**
Si les navigateurs affichent une erreur SSL/TLS sur l'un des sous-domaines, vérifiez les journaux du routeur Caddy :
```bash
docker compose -f docker-compose.prod.yml logs caddy
```
Contrôlez que `ACME_EMAIL` est correct dans `.env.production`, que vos enregistrements DNS sont propagés et que les ports 80/443 sont libres.

**Limitation de débit :** si tous les utilisateurs sont bloqués ensemble, vérifier `API_TRUST_PROXY=true`.

## 12. Importer une visite

Pour préparer la Démo 1 (ou importer une autre visite générique), vous devez exécuter un script d'import depuis votre PC.

**Prérequis :**
- La médiathèque doit être fonctionnelle en production.
- Vous devez disposer d'un compte admin.

**Procédure (PowerShell) :**
Depuis une invite PowerShell sur votre PC, configurez l'accès à l'environnement de production. *Rappel : une connexion via le script fermera la session de votre navigateur sur le même compte.*

```powershell
$env:XPLOR_API_URL='https://admin.xplor.ma'
$env:XPLOR_ADMIN_EMAIL='admin@xplor.local'
$securePwd = Read-Host -Prompt "Mot de passe admin" -AsSecureString
$env:XPLOR_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePwd).Password
```

Exécutez ensuite le script d'import en mode simulation pour valider le processus :
```powershell
pnpm import:oudayas --dry-run
```

Si le test est concluant, lancez l'importation réelle :
```powershell
pnpm import:oudayas
```

**Ce qui est créé :**
- Les images des panoramas sont ajoutées à la médiathèque.
- Une nouvelle visite virtuelle "Les Oudayas" est créée avec ses scènes et hotspots.
- La visite est publiée automatiquement.

**Comment vérifier :**
1. Accédez à la **Médiathèque** du back-office pour vérifier la présence des médias.
2. Dans la liste des visites, vérifiez que "Les Oudayas" est une visite **publiée**.
3. Affichez le **QR** de la visite.
4. Scannez ce QR avec un smartphone pour vérifier que l'URL `https://v.xplor.ma/v/<jeton>` s'ouvre correctement sur mobile.

**Comment recommencer :**
Pour réimporter ou mettre à jour la visite, utilisez l'option `--replace` :
```powershell
pnpm import:oudayas --replace
```

**Importer une autre visite (données génériques) :**
Vous pouvez fournir votre propre fichier JSON et votre dossier de panoramas via les options `--data` et `--dir` :
```powershell
pnpm import:oudayas --data "C:\chemin\vers\mon-tour.json" --dir "C:\chemin\vers\panoramas"
```

## 13. Démo 1 : Scan QR Code des Oudayas

Pour valider l'expérience globale sur mobile depuis la production :
1. Dans le back-office, accédez à la visite virtuelle des "Oudayas".
2. Générez ou affichez le QR code de la visite.
3. Scannez le QR code avec un smartphone. Vous serez redirigé vers l'URL de visionnage `https://v.xplor.ma/v/<jeton>`.
4. Vérifiez que la visite charge correctement les panoramas et que le gyroscope répond bien aux mouvements du téléphone.

---

**Note d'exploitation :**
Les agents de développement IA ne se connectent **JAMAIS** au VPS de production. L'utilisation de commandes telles que `ssh`, `scp` ou d'outils de connexion distants par l'agent est formellement exclue. Ils préparent et testent localement les fichiers nécessaires (compose de prod, scripts shell, configurations), qui sont validés par les tests CI (lint, build, tests scripts). Le déploiement effectif est toujours de la responsabilité du porteur du projet.
