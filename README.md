# Quiz Overlay pour OBS

Overlay HTML/CSS/JS façon jeu TV + panneau admin léger pour piloter les questions, le timer et la révélation des réponses. Compatible avec une source navigateur OBS (fond transparent).

> **🆕 v1.1 - Améliorations** : Sécurité renforcée (CORS + API Key), architecture refactorisée, logging centralisé, validation des données, documentation complète.

## 📚 Documentation

- **[📖 Documentation complète](./docs/DOCUMENTATION.md)** – Vue d’ensemble, API, configuration, dépannage
- **[🔒 Sécurité et clé API](./docs/SECURITE_API_KEY.md)** – Pourquoi et comment configurer la clé API en production
- **GUIDE_UTILISATEUR.txt** – Guide de démarrage pour les utilisateurs finaux (streamers)

## Structure

```
Interface OBS Jeu/
├── DEMARRER.bat        # Lancement simple (Windows) – LiveUpdate + serveur + admin
├── ARRETER.bat         # Arrêt du serveur (Windows)
├── admin/              # Panneau de contrôle (ouvrir dans un navigateur)
├── api/                # API backend Node.js
├── data/               # Données JSON (questions, niveaux, catégories, thèmes)
├── docs/               # Documentation (DOCUMENTATION.md, SECURITE_API_KEY.md)
├── overlay/            # Fichiers affichés dans la source navigateur OBS
└── scripts/            # Scripts organisés par plateforme
    ├── windows/        # PowerShell et batch (live-update.ps1, launch-server.ps1, start.ps1, etc.)
    └── unix/            # Bash (live-update.sh, start.sh, stop.sh, etc.)
```

## 🚀 Lancer rapidement

### Option 1 : Lanceur simple (Windows - Pour utilisateurs finaux) 🎯

**Double-cliquez sur `DEMARRER.bat`** à la racine du projet.

C'est tout ! Le script :
- ✅ **LiveUpdate** : récupère les mises à jour depuis `main` (si le projet est un clone Git)
- ✅ Vérifie automatiquement les prérequis (Node.js)
- ✅ Installe les dépendances si nécessaire
- ✅ Configure le projet automatiquement
- ✅ Démarre le serveur
- ✅ Ouvre l'interface d'administration dans votre navigateur

### LiveUpdate (mises à jour automatiques)

Lors du lancement (DEMARRER.bat ou `start.ps1` / `start.sh`), le projet vérifie s'il est un **clone Git** avec une remote `origin`. Si oui, il exécute `git fetch origin main` puis `git pull origin main` avant de démarrer le serveur. Ainsi, quand vous poussez des mises à jour sur la branche `main`, votre streamer (ou tout utilisateur ayant cloné le dépôt) reçoit les mises à jour au prochain lancement.

**Prérequis pour le LiveUpdate :**
- Projet obtenu via `git clone <url>` (pas un ZIP téléchargé)
- Git installé sur la machine
- Remote `origin` pointant vers votre dépôt (GitHub, GitLab, etc.)

Si Git n'est pas installé ou si le dossier n'est pas un dépôt Git, le lancement continue normalement sans mise à jour.

📖 **Consultez `GUIDE_UTILISATEUR.txt` pour plus d'informations**

### Option 2 : Arrêter le serveur (Windows)

Double-cliquez sur **`ARRETER.bat`** à la racine du projet pour arrêter proprement le serveur.

### Option 3 : Application graphique (Windows)

**Double-cliquez sur `scripts/windows/LancerApp.bat`** pour ouvrir l'application de gestion avec interface graphique.

L'application permet de :
- ✅ Démarrer/arrêter le serveur en un clic
- ✅ Voir le statut en temps réel
- ✅ Ouvrir directement l'admin et l'overlay
- ✅ Vérifier automatiquement l'état du serveur

📖 **[Voir la documentation complète →](./docs/DOCUMENTATION.md)**

### Option 4 : Scripts en ligne de commande

**Windows :**
```powershell
.\scripts\windows\start.ps1
```

**Linux/Mac :**
```bash
chmod +x scripts/unix/*.sh
./scripts/unix/start.sh
```

Puis ouvrez :
- `http://localhost:3000/overlay` dans OBS (Browser Source)
- `http://localhost:3000/admin` dans votre navigateur

**Arrêter :**
```powershell
.\scripts\windows\stop.ps1    # Windows
./scripts/unix/stop.sh         # Linux/Mac
```

📖 **[Voir la documentation complète →](./docs/DOCUMENTATION.md)**

### Option 5 : Sans serveur (mode local)

1. Ouvrez `overlay/index.html` dans OBS via une Browser Source (URL file://).
2. Ouvrez `admin/admin.html` dans votre navigateur pour piloter l'overlay.

Communication overlay/admin : `BroadcastChannel` (même machine / même origine). Un fallback `localStorage` est présent si BroadcastChannel n'est pas disponible.

## Option API Node.js

Si vous préférez servir les questions via une API :

```bash
cd api
npm install express cors googleapis
node server.js
```

L'endpoint `GET /random` renvoie une question tirée de `data/questions.json`.

### Connexion Google Sheets (service account)

1) Dans Google Cloud Console :
- Créez un projet, activez "Google Sheets API".
- Créez un compte de service, générez une clé JSON.
- Notez `client_email` et `private_key`.

2) Dans le Sheet : partagez le document avec l'email du compte de service en "Lecteur".

3) Structure attendue du Google Sheets (5 onglets) :
- **Questions** : ID, IDTheme, Question, Right_Answer, Proposition1, Proposition2, Proposition3, Explications, Type_Question
- **Theme** : ID, IDCategory, IDLevel, Name, Description
- **Category** : ID, Name, Start_Date, End_Date, IDMatiere
- **Level** : ID, Libel
- **Matiere** : ID, Nom

4) Variables d'environnement à définir (ou un fichier `.env` chargé avant `node server.js`) :
- `GOOGLE_SHEETS_ID` : l'ID du Sheet (entre `/d/` et `/edit`).
- `GOOGLE_SHEETS_QUESTIONS_RANGE` : par défaut `Questions!A2:I`.
- `GOOGLE_SHEETS_THEMES_RANGE` : par défaut `Theme!A2:E`.
- `GOOGLE_SHEETS_CATEGORIES_RANGE` : par défaut `Category!A2:E`.
- `GOOGLE_SHEETS_LEVELS_RANGE` : par défaut `Level!A2:B`.
- `GOOGLE_SHEETS_MATIERES_RANGE` : par défaut `Matiere!A2:B`.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` : `client_email` de la clé JSON.
- `GOOGLE_SERVICE_ACCOUNT_KEY` : `private_key` avec les sauts de ligne échappés (`\n`).

5) Lancement :

```bash
# Exemple PowerShell
$env:GOOGLE_SHEETS_ID="<votre_sheet_id>"
$env:GOOGLE_SERVICE_ACCOUNT_EMAIL="<service_account@project.iam.gserviceaccount.com>"
$env:GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
node server.js
```

Si Google Sheets est configuré, **les questions sont chargées depuis le Sheet** (et l’API renvoie une erreur si le Sheet est indisponible). Sans configuration Sheets, l’API utilise `data/questions.json`.

## Conseils OBS

- Activez "Custom CSS" transparent si nécessaire, mais le fond est déjà transparent.
- Désactivez "Use hardware acceleration" si vous constatez des problèmes de rendu avec certaines cartes.
- Résolution conseillée de la source : 1920x200 pour un bandeau bas, mais le layout est responsive.

## Personnalisation

- Ajustez les couleurs et animations dans `overlay/style.css`.
- Changez la durée par défaut dans `overlay/script.js` (`DEFAULT_DURATION`).
- **Base de données (modèle CSV)** : éditez `data/exemple/*.csv`, puis régénérez les JSON avec `node scripts/build-data-from-example.js` (l’API normalise ensuite automatiquement en format “quiz”).

## Limitations connues

- BroadcastChannel nécessite l'ouverture overlay/admin depuis la même origine. Sinon utilisez l'API et servez les deux via le même serveur local.
- Pas de persistance des états entre rechargements : l'admin redemande l'état à l'ouverture.
