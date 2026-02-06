#!/bin/bash

# Quiz Overlay API - Démarrage simple

# Remonter à la racine du projet depuis scripts/unix/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PID_FILE="$PROJECT_ROOT/.server.pid"

# LiveUpdate : récupérer les mises à jour depuis main avant de démarrer
LIVE_UPDATE="$SCRIPT_DIR/live-update.sh"
[ -f "$LIVE_UPDATE" ] && [ -x "$LIVE_UPDATE" ] && "$LIVE_UPDATE"
[ -f "$LIVE_UPDATE" ] && [ ! -x "$LIVE_UPDATE" ] && bash "$LIVE_UPDATE"

cd "$PROJECT_ROOT"

# Vérifier si le serveur est déjà en cours d'exécution
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "⚠️  Un serveur est déjà en cours d'exécution (PID: $OLD_PID)"
    echo "💡 Utilisez ./stop.sh pour l'arrêter d'abord"
    exit 1
  else
    # Le processus n'existe plus, supprimer le fichier PID
    rm -f "$PID_FILE"
  fi
fi

# Charger ou créer .env
if [ ! -f ".env" ]; then
  echo "⚠️  Fichier .env manquant. Création depuis .env.example..."
  ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" ".env"
    echo "✅ Fichier .env créé. Veuillez le configurer avant de relancer."
    exit 1
  else
    echo "❌ Fichier .env.example non trouvé!"
    exit 1
  fi
fi

# Installez les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances"
    exit 1
  fi
fi

# Déterminer le mode
MODE=${1:-dev}

if [ "$MODE" = "prod" ] || [ "$MODE" = "production" ]; then
  echo "🚀 Démarrage en MODE PRODUCTION..."
  export NODE_ENV=production
  
  # Démarrer en arrière-plan et sauvegarder le PID
  nohup npm start > /dev/null 2>&1 &
  SERVER_PID=$!
  echo $SERVER_PID > "$PID_FILE"
  
  sleep 2
  if ps -p "$SERVER_PID" > /dev/null 2>&1; then
    echo "✅ Serveur démarré (PID: $SERVER_PID)"
    echo "🛑 Pour arrêter: ./stop.sh"
  else
    echo "❌ Erreur lors du démarrage du serveur"
    rm -f "$PID_FILE"
    exit 1
  fi
else
  echo "🚀 Démarrage en MODE DÉVELOPPEMENT..."
  export NODE_ENV=development
  
  # En développement, on garde le processus au premier plan
  npm run dev &
  SERVER_PID=$!
  echo $SERVER_PID > "$PID_FILE"
  
  echo "✅ Serveur démarré (PID: $SERVER_PID)"
  echo "🛑 Pour arrêter: Ctrl+C ou ./stop.sh"
  
  # Attendre la fin du processus
  wait $SERVER_PID
  rm -f "$PID_FILE"
fi
