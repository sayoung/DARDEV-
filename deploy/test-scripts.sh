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
if STDERR=$(bash ./restore.sh 2>&1 >/dev/null); then
    echo "Erreur : restore.sh aurait dû échouer sans argument." >&2
    exit 1
fi

if [[ "$STDERR" != *"argument <dossier-de-sauvegarde> manquant"* ]]; then
    echo "Erreur : le message d'erreur est incorrect." >&2
    echo "Message obtenu : $STDERR" >&2
    exit 1
fi
echo "  -> restore.sh échoue correctement avec le bon message."

echo "Tests réussis."
