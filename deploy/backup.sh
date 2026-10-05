#!/usr/bin/env bash
set -euo pipefail

# Ensure the script is run from the repository root
cd "$(dirname "$0")/.."

# Chargement des variables d'environnement silencieusement
if [ -f ".env.production" ]; then
    set -a
    # shellcheck disable=SC1091
    source .env.production
    set +a
else
    echo "Erreur : fichier .env.production introuvable." >&2
    exit 1
fi

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
    echo "Erreur : POSTGRES_USER ou POSTGRES_DB manquant dans .env.production." >&2
    exit 1
fi

# Définition du dossier cible
BACKUP_BASE_DIR="${BACKUP_DIR:-/var/backups/xplor}"
TIMESTAMP=$(date +"%Y%m%d-%H%M")
CURRENT_BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"

echo "Début de la sauvegarde dans ${CURRENT_BACKUP_DIR}..."
mkdir -p "${CURRENT_BACKUP_DIR}"

# En cas d'erreur, on nettoie le dossier en cours pour ne pas laisser de sauvegarde corrompue
cleanup() {
    if [ $? -ne 0 ]; then
        echo "Erreur rencontrée. Nettoyage de la sauvegarde incomplète..." >&2
        rm -rf "${CURRENT_BACKUP_DIR}"
    fi
}
trap cleanup EXIT

# 1. Sauvegarde de PostgreSQL
echo "Sauvegarde de la base de données..."
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_dump -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" > "${CURRENT_BACKUP_DIR}/db.dump.tmp"
mv "${CURRENT_BACKUP_DIR}/db.dump.tmp" "${CURRENT_BACKUP_DIR}/db.dump"

# 2. Sauvegarde des médias (MinIO)
echo "Sauvegarde des médias (volume minio)..."
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T minio tar -czf - -C /data . > "${CURRENT_BACKUP_DIR}/media.tar.gz"

# Vérification de l'archive
if [ ! -s "${CURRENT_BACKUP_DIR}/media.tar.gz" ]; then
    echo "Erreur : L'archive media.tar.gz est vide." >&2
    exit 1
fi

# 3. Rotation des sauvegardes
# Supprime les dossiers de sauvegarde vieux de plus de 7 jours
echo "Nettoyage des sauvegardes de plus de 7 jours..."
find "${BACKUP_BASE_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +

# Désactive le trap d'erreur (tout s'est bien passé)
trap - EXIT

echo "Sauvegarde terminée avec succès."
