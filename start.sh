#!/bin/bash

# Quiz Overlay API - Démarrage simple

cd "$(dirname "$0")/api"

# Charger ou créer .env
if [ ! -f ".env" ]; then
  echo "⚠️  Fichier .env manquant. Création depuis .env.example..."
  cp .env.example .env
  echo "✅ Fichier .env créé. Veuillez le configurer avant de relancer."
  exit 1
fi

# Installez les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances..."
  npm install
fi

# Déterminer le mode
MODE=${1:-dev}

if [ "$MODE" = "prod" ] || [ "$MODE" = "production" ]; then
  echo "🚀 Démarrage en MODE PRODUCTION..."
  export NODE_ENV=production
  npm start
else
  echo "🚀 Démarrage en MODE DÉVELOPPEMENT..."
  export NODE_ENV=development
  npm run dev
fi
