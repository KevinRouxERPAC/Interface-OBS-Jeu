# 📚 Documentation Complète - Quiz Overlay pour OBS

> **Document consolidé** - Toute la documentation du projet en un seul fichier

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Démarrage Rapide](#démarrage-rapide)
3. [LiveUpdate (mises à jour automatiques)](#liveupdate-mises-à-jour-automatiques)
4. [Installation et Configuration](#installation-et-configuration)
5. [Utilisation](#utilisation)
6. [API Documentation](#api-documentation)
7. [Architecture](#architecture)
8. [Sécurité](#sécurité)
9. [Application de Gestion](#application-de-gestion)
10. [Flux de Jeu](#flux-de-jeu)
11. [Dépannage](#dépannage)
12. [Changelog](#changelog)

---

## Vue d'ensemble

**Quiz Overlay pour OBS** est un overlay HTML/CSS/JS façon jeu TV avec un panneau admin léger pour piloter les questions, le timer et la révélation des réponses. Compatible avec une source navigateur OBS (fond transparent).

### Structure du Projet

```
Interface OBS Jeu/
├── README.md                    # Documentation principale
├── server.js                    # Serveur Express unifié (point d'entrée)
├── package.json                 # Dépendances et scripts npm (racine)
├── DEMARRER.bat                 # Lancement simple Windows (LiveUpdate + serveur + admin)
├── ARRETER.bat                  # Arrêt du serveur (Windows)
├── .env.example                 # Template des variables d'environnement
├── .gitignore                   # Fichiers à ignorer dans git
│
├── docs/                        # 📚 DOCUMENTATION
│   ├── DOCUMENTATION.md         # Ce fichier (documentation consolidée)
│
├── api/                         # 🔧 API BACKEND (router Express)
│   ├── server.js                # Router API (monté sous /api)
│   ├── config.js                # Configuration centralisée
│   ├── logger.js                # Système de logging
│   └── validators.js            # Validation des données
│
├── overlay/                     # 👁️ AFFICHAGE OBS
│   ├── index.html               # Page d'affichage
│   ├── script.js                # Logique JavaScript
│   ├── style.css                # Styles CSS
│   ├── design-system.css        # Variables de design
│   ├── audio/                   # Sons (30secondes.wav, correct.wav, etc.)
│   └── image/                   # Images (logo.png)
│
├── admin/                       # 👨‍💼 PANNEAU CONTRÔLE
│   ├── admin.html               # Interface admin
│   ├── admin.js                 # Logique admin
│   └── style.css                # Styles admin
│
├── data/                        # 📊 DONNÉES
│   ├── questions.json           # Questions locales
│   ├── levels.json              # Niveaux de difficulté
│   ├── categories.json          # Catégories
│   ├── themes.json              # Thèmes
│   └── matieres.json            # Matières
│
└── scripts/                     # 🛠️ SCRIPTS
    ├── windows/                 # PowerShell et batch (Windows)
    │   ├── live-update.ps1      # LiveUpdate (git pull main)
    │   ├── launch-server.ps1   # Lancement serveur + admin (utilisé par DEMARRER.bat)
    │   ├── start.ps1            # Démarrer
    │   ├── stop.ps1             # Arrêter
    │   ├── restart.ps1          # Redémarrer
    │   ├── status.ps1           # Statut
    │   ├── LancerApp.bat        # Application graphique
    │   └── QuizOverlayApp.ps1   # Interface de gestion
    └── unix/                    # Bash (Linux/Mac)
        ├── live-update.sh       # LiveUpdate (git pull main)
        ├── start.sh             # Démarrer
        ├── stop.sh              # Arrêter
        ├── restart.sh           # Redémarrer
        └── status.sh            # Statut
```

---

## Démarrage Rapide

### ⚡ 30 secondes pour tester (sans serveur)

1. Ouvrez dans OBS Browser Source l’URL **file** vers le dossier du projet :
   ```
   file:///chemin/vers/Interface OBS Jeu/overlay/index.html
   ```

2. Ouvrez en parallèle dans le navigateur :
   ```
   file:///chemin/vers/Interface OBS Jeu/admin/admin.html
   ```

3. ✅ Prêt ! Les données viennent de `data/questions.json`

### 🚀 Avec serveur API (recommandé)

#### Lanceur simple Windows (utilisateurs finaux / streamers)

**Double-cliquez sur `DEMARRER.bat`** à la racine du projet.

Le script :
- ✅ **LiveUpdate** : récupère les mises à jour depuis la branche `main` (si le projet est un clone Git)
- ✅ Vérifie les prérequis (Node.js)
- ✅ Installe les dépendances si nécessaire
- ✅ Démarre le serveur
- ✅ Ouvre l'interface d'administration dans le navigateur

**Arrêter le serveur :** double-cliquez sur **`ARRETER.bat`** à la racine du projet.

#### Application Windows (interface graphique)

**Double-cliquez sur `scripts/windows/LancerApp.bat`** pour ouvrir l'application de gestion avec interface graphique.

L'application permet de :
- ✅ Démarrer/arrêter le serveur en un clic
- ✅ Voir le statut en temps réel
- ✅ Ouvrir directement l'admin et l'overlay
- ✅ Vérifier automatiquement l'état du serveur

#### Scripts en ligne de commande

**Windows :**
```powershell
.\scripts\windows\start.ps1      # Démarrer
.\scripts\windows\stop.ps1       # Arrêter
.\scripts\windows\restart.ps1    # Redémarrer
.\scripts\windows\status.ps1     # Statut
```

**Linux/Mac :**
```bash
chmod +x scripts/unix/*.sh
./scripts/unix/start.sh           # Démarrer
./scripts/unix/stop.sh            # Arrêter
./scripts/unix/restart.sh         # Redémarrer
./scripts/unix/status.sh          # Statut
```

#### Installation manuelle

À la racine du projet :

```bash
npm install
npm run dev          # Développement
npm start            # Production
```

### Vérifier que ça marche

```bash
# Le serveur écoute sur http://localhost:3000
curl http://localhost:3000/api/health
# Doit retourner : {"status":"ok","timestamp":"..."}
```

### Utiliser dans OBS/navigateur

- Overlay : `http://localhost:3000/overlay`
- Admin : `http://localhost:3000/admin`

---

## LiveUpdate (mises à jour automatiques)

Lors du lancement (**DEMARRER.bat**, **launch-server.ps1**, **start.ps1** ou **start.sh**), le projet vérifie s'il est un **clone Git** avec une remote `origin`. Si oui, il exécute `git fetch origin main` puis `git pull origin main` avant de démarrer le serveur. Ainsi, quand vous poussez des mises à jour sur la branche `main`, tout utilisateur ayant cloné le dépôt (par exemple un streamer) reçoit les mises à jour au prochain lancement.

**Prérequis pour le LiveUpdate :**
- Projet obtenu via `git clone <url>` (pas un ZIP téléchargé)
- Git installé sur la machine
- Remote `origin` pointant vers le dépôt (GitHub, GitLab, etc.)

Si Git n'est pas installé ou si le dossier n'est pas un dépôt Git, le lancement continue normalement sans mise à jour. Les scripts concernés sont :
- **Windows :** `scripts/windows/live-update.ps1` (appelé automatiquement par `launch-server.ps1` et `start.ps1`)
- **Linux/Mac :** `scripts/unix/live-update.sh` (appelé automatiquement par `start.sh`)

---

## Installation et Configuration

### Prérequis

- **Node.js** >= 14.0.0
- **npm** (généralement inclus avec Node.js)
- **OBS Studio** (pour l'overlay)

### Configuration des variables d'environnement

1. Copiez le fichier d'exemple à la racine du projet :
   ```bash
   cp .env.example .env
   ```

2. Éditez `.env` à la racine avec vos paramètres :
   ```bash
   # Serveur
   PORT=3000
   NODE_ENV=development
   
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
   
   # Google Sheets (optionnel)
   GOOGLE_SHEETS_ID=...
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_SERVICE_ACCOUNT_KEY=...
   
   # Logging
   LOG_LEVEL=info  # error, warn, info, debug
   ```

### Configuration Google Sheets (base de données)

1. **Dans Google Cloud Console :**
   - Créez un projet
   - Activez "Google Sheets API"
   - Créez un compte de service
   - Générez une clé JSON
   - Notez `client_email` et `private_key`

2. **Dans le Sheet :**
   - Partagez le document avec l'email du compte de service en "Lecteur"

3. **Structure attendue du Google Sheets (5 onglets) :**
   - **Questions** : ID, IDTheme, Question, Right_Answer, Proposition1, Proposition2, Proposition3, Explications, Type_Question
   - **Theme** : ID, IDCategory, IDLevel, Name, Description
   - **Category** : ID, Name, Start_Date, End_Date, IDMatiere
   - **Level** : ID, Libel
   - **Matiere** : ID, Nom

4. **Variables d'environnement :**
   ```bash
   GOOGLE_SHEETS_ID=<id du sheet>
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<email du compte service>
   GOOGLE_SERVICE_ACCOUNT_KEY=<clé privée avec \n échappés>
   ```

**Fonctionnement** : à chaque démarrage du serveur, si Google Sheets est configuré, l’app **importe tout** (questions, thèmes, catégories, niveaux, matières) depuis le Sheet vers les fichiers `data/*.json`. Ensuite, toutes les requêtes API lisent **uniquement** ces JSON locaux — plus besoin de connexion internet pendant l’utilisation. Sans Google Sheets configuré, l’app utilise les JSON déjà présents dans `data/`.

---

## Utilisation

### Commandes principales depuis le panneau admin

| Bouton | Action |
|--------|--------|
| "Nouvelle Sélection" | Lance le processus de sélection (niveau → catégorie → thème) |
| "Tirer un Thème" | Tire un thème aléatoire dans la catégorie sélectionnée |
| "Lancer la Question" | Charge et affiche une question du thème sélectionné |
| "Révéler Réponse" | Affiche la bonne réponse en surbrillance |
| "Nouvelle Question" | Lance une nouvelle question du même thème |
| A, B, C, D | Sélectionne la réponse correspondante |
| "Arrêter le Serveur" | Arrête le serveur depuis l'interface admin |

### Gestion des sons

- **Au lancement d'une question** : `30secondes.wav` démarre en boucle
- **Si le timer arrive à la fin** : Le son du timer s'arrête et la réponse est révélée (aucun son si aucune sélection)
- **Lors de la sélection d'une réponse** : Le timer et son son s'arrêtent, `select.wav` démarre
- **Lors de la révélation** :
  - Si correcte : `select.wav` s'arrête, `correct.wav` démarre
  - Si fausse : `select.wav` s'arrête, `wrong.wav` démarre

### Configuration OBS

1. **Créez une Browser Source**
   - URL: `http://localhost:3000/overlay`
   - En production : `http://votre-serveur.com:3000/overlay`
   - Largeur: 1920
   - Hauteur: 200 (ajustez selon vos besoins)
   - Custom CSS: (optionnel, le fond est déjà transparent)

2. **Positionnez l'élément** où vous le souhaitez dans la scène

3. **Cliquez sur le Web-Hook Interactions** pour autoriser OBS

**Note :** En mode développement, aucune clé API n'est nécessaire. En production, la clé API est requise pour la synchronisation.

---

## API Documentation

### Endpoints disponibles

#### Endpoints publics (sans authentification)

- `GET /api/health` - Vérifier que le serveur est actif
- `GET /overlay` - Page d'affichage overlay (lecture seule)
- `GET /admin` - Interface admin

#### Endpoints principaux

Tous les endpoints ci-dessous sont préfixés par `/api` :

**Questions**
- `GET /api/random?levelId=X&categoryId=Y&themeId=Z` - Question aléatoire avec filtres optionnels
- `GET /api/levels` - Liste des niveaux de difficulté
- `GET /api/categories?matiereId=X&levelId=Y` - Liste des catégories (filtres optionnels)
- `GET /api/themes?categoryId=X&levelId=Y` - Thèmes d'une catégorie (filtrés par niveau optionnel)

**Synchronisation**
- `POST /api/command` - Envoyer une commande (admin → overlay)
- `GET /api/command` - Lire la dernière commande
- `POST /api/state` - Mettre à jour l'état de l'overlay
- `GET /api/state` - Lire l'état actuel

**Administration**
- `POST /api/shutdown` - Arrêter le serveur

### Format des Données

#### Source locale (modèle CSV / Sheets)

Le projet peut utiliser la même **architecture “base de données”** que `data/exemple/` (Matière → Catégorie → Thème (porte le niveau) → Question).

- Les “tables” locales sont stockées dans `data/matieres.json`, `data/categories.json`, `data/themes.json`, `data/levels.json`.
- Les questions locales peuvent être stockées au format **table** (proche CSV/Sheets) dans `data/questions.json` :

```json
{
  "id": "1",
  "idTheme": "1",
  "question": "…",
  "rightAnswer": "Bonne réponse",
  "proposition1": "Fausse 1",
  "proposition2": "Fausse 2",
  "proposition3": "Fausse 3",
  "explication": "…",
  "typeQuestion": "QCM"
}
```

L’API normalise automatiquement ces questions en format “quiz” (propositions + index de bonne réponse) au moment de servir `/random`.

#### Question
```json
{
  "id": 1,
  "question": "Question texte ?",
  "propositions": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  "bonneReponse": 2,
  "explication": "Explication...",
  "theme": "Géographie",
  "matiere": "Sciences",
  "niveau": "Collège",
  "duration": 30
}
```

#### Commande
```json
{
  "type": "LOAD_QUESTION",
  "question": { /* objet question */ },
  "level": { /* objet level */ },
  "category": { /* objet category */ },
  "theme": { /* objet theme */ }
}
```

#### État de l'overlay
```json
{
  "question": { /* objet question */ },
  "timer": 15,
  "selectedIndex": 2,
  "timestamp": 1234567890
}
```

---

## Architecture

### Flux de données

```
┌─────────────────────────────────────────┐
│          Admin (navigateur)             │
│  - Sélection questions                  │
│  - Contrôle timer                       │
│  - Révélation réponses                  │
└──────────┬──────────────────────────────┘
           │ BroadcastChannel (local)
           │ ou localStorage
           │ ou HTTP (POST /command)
           ▼
┌─────────────────────────────────────────┐
│        Serveur API (Node.js)            │
│  ✅ Authentification (API Key)          │
│  ✅ Validation (validators)             │
│  ✅ Logging (logger)                    │
│  ✅ CORS sécurisé (config)              │
│  - Bus de commandes                     │
│  - Stockage d'état                      │
│  - Proxy Google Sheets/JSON             │
└──────────┬──────────────────────────────┘
           │ HTTP (GET /command, POST /state)
           │ ou localStorage
           ▼
┌─────────────────────────────────────────┐
│        Overlay (OBS Browser Source)    │
│  - Affichage questions                  │
│  - Timer visuel                         │
│  - Révélation réponses                  │
└─────────────────────────────────────────┘
```

### Modules de l'API

- **config.js** - Configuration centralisée (port, environnement, CORS, etc.)
- **logger.js** - Système de logging avec niveaux (error, warn, info, debug)
- **validators.js** - Validation des données (questions, commandes, état)
- **server.js** - Point d'entrée principal avec routes Express

---

## Sécurité


### Checklist de sécurité

- [x] CORS restreint à `ALLOWED_ORIGINS`
- [x] Validation des données entrantes (validators.js)
- [x] Secrets en variables d'environnement
- [x] `.gitignore` configuré pour ignorer `.env`
- [x] Mode production vs développement
- [x] Error handling global sans révéler les détails

### Checklist avant production

- [ ] Définir `NODE_ENV=production`
- [ ] Définir `ALLOWED_ORIGINS` correctement
- [ ] Définir `LOG_LEVEL=info` (pas debug)
- [ ] Vérifier que `.env` n'est pas dans git
- [ ] Tester tous les endpoints avec la clé API
- [ ] Tester le fallback JSON (si Google Sheets down)
- [ ] Configurer HTTPS
- [ ] Configurer un reverse proxy (nginx, etc)
- [ ] Configurer les logs (stdout ou fichier)
- [ ] Configurer un process manager (PM2, systemd)

### Commandes de vérification

```bash
# Vérifier les dépendances
npm audit

# Vérifier la syntaxe
node -c server.js

# Tester l'API en local
curl http://localhost:3000/api/health
```

---

## Application de Gestion

### Lancement

**Option 1 : Double-clic sur le fichier batch**
Double-cliquez sur `scripts/windows/LancerApp.bat` dans le projet.

**Option 2 : Exécution PowerShell directe**
```powershell
.\scripts\windows\QuizOverlayApp.ps1
```

### Fonctionnalités

- ✅ **Vérification du statut** - Automatique toutes les 5 secondes
- ✅ **Démarrer le serveur** - Vérifie `.env`, installe dépendances, démarre le serveur
- ✅ **Arrêter le serveur** - Arrête proprement le processus Node.js
- ✅ **Ouvrir Admin** - Ouvre `http://localhost:3000/admin`
- ✅ **Ouvrir Overlay** - Ouvre `http://localhost:3000/overlay`
- ✅ **Actualiser** - Met à jour manuellement le statut

### Prérequis

- **Windows** avec PowerShell 5.1 ou supérieur
- **Node.js** installé et dans le PATH
- **npm** installé (généralement inclus avec Node.js)

---

## Flux de Jeu

### Vue d'ensemble

Le quiz fonctionne en deux interfaces synchronisées :
- **Overlay** : Affiché au public dans OBS (lecture seule, aucun clic du public)
- **Admin** : Interface de contrôle du streamer (contrôle total du flux)

### Étapes du flux

1. **Démarrage** - Écran d'attente sur l'overlay, bouton "Nouvelle Sélection" actif sur l'admin
2. **Sélection Difficulté** - Admin choisit un niveau (Collège, Lycée, Licence, Master)
3. **Sélection Catégorie** - Admin choisit une catégorie dans le niveau sélectionné
4. **Sélection Thème** - Admin tire un thème aléatoire dans la catégorie
5. **Lancement Question** - Admin lance une question du thème sélectionné
6. **Timer actif** - Le timer démarre avec le son `30secondes.wav` en boucle
7. **Sélection Réponse** - Admin sélectionne une réponse (A/B/C/D), le timer s'arrête, `select.wav` joue
8. **Révélation** - Admin révèle la réponse, `select.wav` s'arrête, `correct.wav` ou `wrong.wav` joue
9. **Nouvelle Question** - Admin peut lancer une nouvelle question du même thème
10. **Nouvelle Sélection** - Admin peut recommencer depuis le début

---

## Dépannage

### Le serveur ne démarre pas

```bash
# Vérifiez que Node.js est installé
node --version

# À la racine du projet : installez les dépendances
npm install

# Relancez en mode debug
$env:LOG_LEVEL='debug'
npm run dev
```

### OBS ne voit pas l'overlay

- Vérifiez l'URL dans la Browser Source de OBS
- Vérifiez que le serveur écoute (check `http://localhost:3000/api/health`)
- Essayez avec `http://localhost:3000/overlay` au lieu d'une URL `file://`

### Admin ne se synchro pas avec overlay

- Ouvrez la console du navigateur (F12)
- Cherchez les erreurs en rouge
- Vérifiez que le serveur tourne (check `http://localhost:3000/api/health`)
- En développement : aucune clé API nécessaire
- En production : vérifiez que la clé API est correctement configurée

### Les données ne chargent pas

- Vérifiez que `data/questions.json` existe
- Vérifiez que le JSON est valide (utilisez https://jsonlint.com/)
- Activez le debug pour voir les logs : `LOG_LEVEL=debug npm run dev`

### Erreur : "Clé API invalide"

- Vérifiez que `X-API-Key` est envoyée dans les en-têtes

### Erreur : "CORS non autorisé"

- Vérifiez `ALLOWED_ORIGINS` dans `.env`
- Incluez le protocol complet (http:// ou https://)

### Google Sheets ne charge pas au démarrage

- Au démarrage, si le sync échoue, le serveur utilise les JSON déjà présents dans `data/` (s’ils existent)
- Vérifiez les variables d’environnement dans `api/.env` (GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY)
- Consultez les logs du serveur au lancement (message « Import Google Sheets → JSON locaux » ou erreur)

---

## Changelog

### Version 1.4 (février 2026)

#### Architecture
- ✅ **Serveur unifié à la racine** : `server.js` et `package.json` à la racine du projet
- ✅ **Sync Google Sheets → JSON au démarrage** : à chaque lancement, import des données du Sheet vers `data/*.json` ; ensuite l’app lit uniquement en local (plus besoin d’internet)
- ✅ API montée sous `/api` (health check : `/api/health`, commandes : `/api/command`, etc.)
- ✅ Fichier `.env` dans `api/` pour la config (Google Sheets, etc.)

#### Nettoyage
- ✅ Suppression de `api/package.json` (redondant)
- ✅ Documentation consolidée et à jour

### Version 1.3 (5 février 2026)

#### Nouvelles fonctionnalités
- ✅ **LiveUpdate** : mise à jour automatique depuis la branche `main` au lancement (DEMARRER.bat, start.ps1, start.sh)
- ✅ Scripts `live-update.ps1` (Windows) et `live-update.sh` (Unix) pour `git fetch` + `git pull origin main` avant démarrage

#### Améliorations
- ✅ Intégration du LiveUpdate dans `launch-server.ps1` et `start.ps1` / `start.sh`
- ✅ Documentation mise à jour (README, DOCUMENTATION) avec LiveUpdate et structure actuelle

### Version 1.2 (26 janvier 2026)

#### Nouvelles fonctionnalités
- ✅ Application Windows avec interface graphique (`QuizOverlayApp.ps1`, `LancerApp.bat`)
- ✅ Bouton d'arrêt du serveur dans l'interface admin
- ✅ Endpoint `/shutdown` pour arrêter le serveur depuis l'admin
- ✅ Gestion améliorée des sons (arrêt du timer lors de la sélection, arrêt du son de sélection lors de la révélation)

#### Améliorations
- ✅ Scripts PowerShell améliorés pour sauvegarder le PID en mode production
- ✅ Documentation consolidée dans un seul fichier
- ✅ Nettoyage des fichiers redondants

### Version 1.1

#### Sécurité
- ✅ CORS restreint à une whitelist configurable (`ALLOWED_ORIGINS`)
- ✅ Validation stricte de tous les inputs (validators.js)
- ✅ Mode développement vs production
- ✅ `.gitignore` configuré pour éviter les fuites de secrets
- ✅ `.env.example` fourni comme template

#### Architecture et Code
- ✅ **config.js** - Configuration centralisée
- ✅ **logger.js** - Système de logging réutilisable avec niveaux
- ✅ **validators.js** - Validation des données
- ✅ Error handling global dans Express
- ✅ Logging des opérations pour faciliter le débogage

#### Documentation
- ✅ Documentation complète et organisée
- ✅ Guides de démarrage rapide
- ✅ Documentation API complète

---

## Personnalisation

### Couleurs et styles
Modifiez les variables CSS dans `overlay/style.css`

### Timer par défaut
Changez `DEFAULT_DURATION` dans `overlay/script.js`

### Questions
La base est votre Google Sheet. Au démarrage, les données sont importées dans `data/*.json`. Pour mettre à jour les questions, modifiez le Sheet puis relancez le serveur (ou éditez directement les JSON en `data/`).

---

## Limitations connues

- BroadcastChannel nécessite l'ouverture overlay/admin depuis la même origine. Sinon utilisez l'API et servez les deux via le même serveur local.
- Pas de persistance des états entre rechargements : l'admin redemande l'état à l'ouverture.

---

## Dépendances

- **Express** ^4.18.2 - Framework HTTP
- **CORS** ^2.8.5 - Gestion CORS
- **dotenv** ^16.4.5 - Variables d'environnement
- **googleapis** ^170.0.0 - Intégration Google Sheets

---

## Support

Pour toute question ou problème :
1. Consultez la section [Dépannage](#dépannage)
2. Vérifiez les logs du serveur (`LOG_LEVEL=debug`)
3. Consultez la console du navigateur (F12)

---

**Dernière mise à jour :** février 2026  
**Version :** 1.4
