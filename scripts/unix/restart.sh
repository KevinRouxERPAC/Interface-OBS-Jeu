#!/bin/bash

# Quiz Overlay API - Redémarrage du serveur

# Remonter à la racine du projet depuis scripts/unix/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STOP_SCRIPT="$SCRIPT_DIR/stop.sh"
START_SCRIPT="$SCRIPT_DIR/start.sh"

echo "🔄 Redémarrage du serveur..."
echo ""

# Arrêter le serveur
if [ -f "$STOP_SCRIPT" ]; then
    "$STOP_SCRIPT"
    sleep 2
else
    echo "[ERREUR] Script stop.sh non trouvé" >&2
    exit 1
fi

# Démarrer le serveur
if [ -f "$START_SCRIPT" ]; then
    echo ""
    echo "▶️  Démarrage du serveur..."
    "$START_SCRIPT" "$@"
else
    echo "[ERREUR] Script start.sh non trouvé" >&2
    exit 1
fi
