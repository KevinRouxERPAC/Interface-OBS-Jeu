#!/bin/bash

# Quiz Overlay API - Statut du serveur

# Remonter à la racine du projet depuis scripts/unix/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PID_FILE="$PROJECT_ROOT/api/.server.pid"

echo "📊 Statut du serveur Quiz Overlay API"
echo ""

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Serveur en cours d'exécution"
        echo "   PID: $PID"
        
        # Informations sur le processus
        if command -v ps > /dev/null 2>&1; then
            START_TIME=$(ps -o lstart= -p "$PID" 2>/dev/null || echo "N/A")
            MEMORY=$(ps -o rss= -p "$PID" 2>/dev/null | awk '{printf "%.2f MB", $1/1024}')
            echo "   Démarrage: $START_TIME"
            echo "   Mémoire: $MEMORY"
        fi
        
        # Tester si le serveur répond
        if curl -s -f -m 2 http://localhost:3000/health > /dev/null 2>&1; then
            echo "   Health: ✅ OK"
        else
            echo "   Health: ⚠️  Ne répond pas"
        fi
    else
        echo "❌ Serveur arrêté (fichier PID obsolète)"
        rm -f "$PID_FILE"
    fi
else
    echo "❌ Serveur arrêté"
    
    # Vérifier s'il y a des processus Node.js qui pourraient être le serveur
    NODE_PROCESSES=$(ps aux | grep "[n]ode.*server.js" | grep -v grep)
    if [ -n "$NODE_PROCESSES" ]; then
        echo ""
        echo "⚠️  Processus Node.js détectés (sans fichier PID):"
        echo "$NODE_PROCESSES" | awk '{print "   PID: " $2 " | " $11 " " $12 " " $13}'
    fi
fi

echo ""
echo "💡 Commandes disponibles:"
echo "   ./start.sh      - Démarrer le serveur"
echo "   ./stop.sh       - Arrêter le serveur"
echo "   ./restart.sh    - Redémarrer le serveur"
echo "   ./status.sh     - Afficher le statut"
