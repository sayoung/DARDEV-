#!/usr/bin/env bash
set -euo pipefail

# Aller dans le dossier deploy
cd "$(dirname "$0")"

echo "Vérification syntaxique des scripts (bash -n)..."
for script in *.sh; do
    echo "  - $script"
    bash -n "$script"
done

echo "Test de restore.sh (sans argument)..."
if ./restore.sh > /dev/null 2>&1; then
    echo "Erreur : restore.sh aurait dû échouer sans argument." >&2
    exit 1
fi
echo "  -> restore.sh échoue correctement."

echo "Tests réussis."
