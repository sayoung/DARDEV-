#!/usr/bin/env bash
set -euo pipefail

# Ensure the script is run from the repository root
if [[ ! -f "docker-compose.prod.yml" ]]; then
    echo "Error: docker-compose.prod.yml not found. Please run this script from the repository root."
    exit 1
fi

if [[ ! -f ".env.production" ]]; then
    echo "Error: .env.production file not found."
    exit 1
fi

if grep -q "CHANGER_MOI" ".env.production"; then
    echo "Error: .env.production contains 'CHANGER_MOI'. Please configure it properly before deploying."
    exit 1
fi

SEED=false
for arg in "$@"; do
    if [[ "$arg" == "--seed" ]]; then
        SEED=true
    fi
done

echo "Building production images..."
docker compose --env-file .env.production -f docker-compose.prod.yml build

echo "Starting infrastructure services..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis minio minio-init

echo "Applying database migrations..."
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps -e HOME=/tmp api npx --yes prisma@6.19.3 migrate deploy --schema prisma/schema.prisma

if [[ "$SEED" == "true" ]]; then
    echo "Seeding database..."
    docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps api node dist/cli/main.js seed
fi

echo "Starting all services..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

echo "Container status:"
docker compose --env-file .env.production -f docker-compose.prod.yml ps

echo "Deployment completed successfully."
