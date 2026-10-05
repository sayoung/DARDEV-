#!/usr/bin/env bash
set -euo pipefail

# Ensure the script is run from the repository root
cd "$(dirname "$0")/.."

YES_FLAG=0
BACKUP_DIR=""

for arg in "$@"; do
    if [ "$arg" = "--yes" ]; then
        YES_FLAG=1
    elif [ -z "$BACKUP_DIR" ]; then
        BACKUP_DIR="$arg"
    else
        echo "Erreur : argument inattendu '$arg'." >&2
        exit 1
    fi
done

if [ -z "$BACKUP_DIR" ]; then
    echo "Erreur : argument <dossier-de-sauvegarde> manquant." >&2
    exit 1
fi

if [ ! -f "$BACKUP_DIR/db.dump" ]; then
    echo "Erreur : le fichier db.dump est introuvable dans '$BACKUP_DIR'." >&2
    exit 1
fi

if [ "$YES_FLAG" -eq 0 ]; then
    read -p "Êtes-vous sûr de vouloir écraser la base de données et les médias ? (taper OUI pour confirmer) : " confirm
    if [ "$confirm" != "OUI" ]; then
        echo "Restauration annulée."
        exit 0
    fi
fi

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

echo "Arrêt des services api et worker..."
docker compose -f docker-compose.prod.yml stop api worker

echo "Restauration de la base de données..."
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore --clean --if-exists --no-owner -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "$BACKUP_DIR/db.dump"

if [ -f "$BACKUP_DIR/media.tar.gz" ]; then
    echo "Restauration des médias..."
    docker compose -f docker-compose.prod.yml exec -T minio sh -c "tar -xzf - -C /data" < "$BACKUP_DIR/media.tar.gz"
fi

echo "Redémarrage des services api et worker..."
docker compose -f docker-compose.prod.yml start api worker

echo "Restauration terminée avec succès."
