#!/bin/bash
# Quiz Overlay - LiveUpdate : récupère les mises à jour depuis origin/main au lancement
# À utiliser avant de démarrer le serveur (start.sh)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GIT_DIR="$PROJECT_ROOT/.git"

# Vérifier si Git est disponible
if ! command -v git >/dev/null 2>&1; then
    echo "[LiveUpdate] Git non installé - mise à jour ignorée"
    exit 0
fi

# Vérifier si on est dans un dépôt Git (clone)
if [ ! -d "$GIT_DIR" ]; then
    echo "[LiveUpdate] Ce dossier n'est pas un clone Git - mise à jour ignorée"
    exit 0
fi

cd "$PROJECT_ROOT" || exit 0

# Vérifier qu'on a une remote "origin"
if ! git remote | grep -q "origin"; then
    echo "[LiveUpdate] Aucune remote 'origin' - mise à jour ignorée"
    exit 0
fi

echo "[LiveUpdate] Vérification des mises à jour sur main..."
if ! git fetch origin main 2>/dev/null; then
    echo "[LiveUpdate] Impossible de récupérer les mises à jour (réseau ?)"
    exit 0
fi

STATUS_BEFORE=$(git rev-parse HEAD 2>/dev/null)
if ! git pull origin main --no-edit 2>/dev/null; then
    echo "[LiveUpdate] Mise à jour annulée (conflits ou modifications locales ?)"
    echo "              Vous pouvez mettre à jour manuellement : git pull origin main"
    exit 0
fi
STATUS_AFTER=$(git rev-parse HEAD 2>/dev/null)

if [ "$STATUS_BEFORE" != "$STATUS_AFTER" ]; then
    echo "[LiveUpdate] Mise à jour installée - projet à jour avec main"
    if [ -f "$PROJECT_ROOT/api/package.json" ]; then
        echo "[LiveUpdate] Pensez à relancer si des dépendances ont changé (npm install dans api/)"
    fi
else
    echo "[LiveUpdate] Déjà à jour avec main"
fi

exit 0
