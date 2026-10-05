#!/bin/bash
set -euo pipefail

# Définition du dossier cible
BACKUP_BASE_DIR="${BACKUP_DIR:-/var/backups/xplor}"
TIMESTAMP=$(date +"%Y%m%d-%H%M")
CURRENT_BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"

echo "Début de la sauvegarde dans ${CURRENT_BACKUP_DIR}..."

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

mkdir -p "${CURRENT_BACKUP_DIR}"

# 1. Sauvegarde de PostgreSQL
echo "Sauvegarde de la base de données..."
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" > "${CURRENT_BACKUP_DIR}/db.dump"

# 2. Sauvegarde des médias (MinIO)
# On utilise un conteneur éphémère alpine monté en lecture seule sur le volume MinIO
echo "Sauvegarde des médias (volume xplor_prod_minio)..."
docker run --rm \
    -v xplor_prod_minio:/data:ro \
    -v "${CURRENT_BACKUP_DIR}:/backup" \
    alpine tar -czf /backup/media.tar.gz -C /data .

# 3. Rotation des sauvegardes
# Supprime les dossiers de sauvegarde vieux de plus de 7 jours
echo "Nettoyage des sauvegardes de plus de 7 jours..."
find "${BACKUP_BASE_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +

echo "Sauvegarde terminée avec succès."
