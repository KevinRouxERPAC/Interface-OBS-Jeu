#!/bin/bash

# Quiz Overlay API - Arrêt du serveur

# Remonter à la racine du projet depuis scripts/unix/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PID_FILE="$PROJECT_ROOT/api/.server.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "🛑 Arrêt du serveur (PID: $PID)..."
    
    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null
        echo "✅ Serveur arrêté avec succès"
    else
        echo "⚠️  Processus déjà arrêté ou introuvable"
    fi
    
    rm -f "$PID_FILE"
else
    echo "⚠️  Aucun fichier PID trouvé. Recherche des processus Node.js..."
    
    # Chercher les processus Node.js dans le répertoire du projet
    NODE_PROCESSES=$(ps aux | grep "[n]ode.*server.js" | grep -v grep)
    
    if [ -n "$NODE_PROCESSES" ]; then
        echo "📋 Processus Node.js trouvés:"
        echo "$NODE_PROCESSES"
        echo ""
        echo "💡 Pour arrêter un processus spécifique, utilisez:"
        echo "   kill <PID>"
    else
        echo "✅ Aucun serveur en cours d'exécution"
    fi
fi
