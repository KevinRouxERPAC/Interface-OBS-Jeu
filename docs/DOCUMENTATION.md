# 📚 Documentation Complète - Quiz Overlay pour OBS

> **Document consolidé** - Toute la documentation du projet en un seul fichier

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Démarrage Rapide](#démarrage-rapide)
3. [Installation et Configuration](#installation-et-configuration)
4. [Utilisation](#utilisation)
5. [API Documentation](#api-documentation)
6. [Architecture](#architecture)
7. [Sécurité](#sécurité)
8. [Application de Gestion](#application-de-gestion)
9. [Flux de Jeu](#flux-de-jeu)
10. [Dépannage](#dépannage)
11. [Changelog](#changelog)

---

## Vue d'ensemble

**Quiz Overlay pour OBS** est un overlay HTML/CSS/JS façon jeu TV avec un panneau admin léger pour piloter les questions, le timer et la révélation des réponses. Compatible avec une source navigateur OBS (fond transparent).

### Structure du Projet

```
Interface OBS Jeu/
├── README.md                    # Documentation principale
├── DOCUMENTATION.md             # Ce fichier (documentation consolidée)
├── QUICK_START.md               # Guide de démarrage rapide
├── GUIDE_LANCEMENT.md           # Guide de lancement détaillé
├── .env.example                 # Template des variables d'environnement
├── .gitignore                   # Fichiers à ignorer dans git
│
├── api/                         # 🔧 SERVEUR BACKEND
│   ├── server.js                # Point d'entrée principal
│   ├── config.js                # Configuration centralisée
│   ├── logger.js                # Système de logging
│   ├── validators.js            # Validation des données
│   └── package.json             # Dépendances Node.js
│
├── overlay/                     # 👁️ AFFICHAGE OBS
│   ├── index.html               # Page d'affichage
│   ├── script.js                # Logique JavaScript
│   ├── style.css                # Styles CSS
│   ├── audio/                   # Sons (30secondes.wav, correct.wav, etc.)
│   └── image/                   # Images (logo.png)
│
├── admin/                       # 👨‍💼 PANNEAU CONTRÔLE
│   ├── admin.html               # Interface admin
│   └── admin.js                 # Logique admin
│
└── data/                        # 📊 DONNÉES
    ├── questions.json           # Questions locales
    ├── levels.json              # Niveaux de difficulté
    ├── categories.json          # Catégories
    └── themes.json              # Thèmes
```

---

## Démarrage Rapide

### ⚡ 30 secondes pour tester (sans serveur)

1. Ouvrez dans OBS Browser Source :
   ```
   file:///C:/Users/kevin/Documents/Interface OBS Jeu/overlay/index.html
   ```

2. Ouvrez en parallèle dans le navigateur :
   ```
   file:///C:/Users/kevin/Documents/Interface OBS Jeu/admin/admin.html
   ```

3. ✅ Prêt ! Les données viennent de `data/questions.json`

### 🚀 Avec serveur API (recommandé)

#### Application Windows (Recommandé)

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

```bash
cd api
npm install
npm run dev          # Développement
npm start            # Production
```

### Vérifier que ça marche

```bash
# Le serveur écoute sur http://localhost:3000
curl http://localhost:3000/health
# Doit retourner : {"status":"ok","timestamp":"..."}
```

### Utiliser dans OBS/navigateur

- Overlay : `http://localhost:3000/overlay`
- Admin : `http://localhost:3000/admin`

---

## Installation et Configuration

### Prérequis

- **Node.js** >= 14.0.0
- **npm** (généralement inclus avec Node.js)
- **OBS Studio** (pour l'overlay)

### Configuration des variables d'environnement

1. Copiez le fichier d'exemple :
   ```bash
   cp .env.example api/.env
   ```

2. Éditez `api/.env` avec vos paramètres :
   ```bash
   # Serveur
   PORT=3000
   NODE_ENV=development
   
   # Authentification (optionnel en dev, requis en prod)
   API_KEY=votre-clé-secrète-très-longue
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
   
   # Google Sheets (optionnel)
   GOOGLE_SHEETS_ID=...
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_SERVICE_ACCOUNT_KEY=...
   
   # Logging
   LOG_LEVEL=info  # error, warn, info, debug
   ```

### Configuration de la Clé API

#### En développement
La clé API est optionnelle si elle n'est pas définie dans `.env`.

#### En production
La clé API est **requise**. Définissez dans `.env`:
```bash
API_KEY=votre-clé-secrète-très-longue
NODE_ENV=production
```

#### Utilisation depuis l'overlay/admin
Les clés API sont automatiquement envoyées via le header `X-API-Key` si stockées dans `localStorage` :
```javascript
localStorage.setItem('quiz-api-key', 'votre-clé');
```

### Configuration Google Sheets (optionnel)

1. **Dans Google Cloud Console :**
   - Créez un projet
   - Activez "Google Sheets API"
   - Créez un compte de service
   - Générez une clé JSON
   - Notez `client_email` et `private_key`

2. **Dans le Sheet :**
   - Partagez le document avec l'email du compte de service en "Lecteur"

3. **Structure attendue du Google Sheets (5 onglets) :**
   - **Questions** : ID, IDTheme, IDLevel, Question, Right_Answer, Proposition1, Proposition2, Proposition3, Explications, Type_Question
   - **Theme** : ID, IDCategory, Name, Description
   - **Category** : ID, Name, Start_Date, End_Date, IDMatiere
   - **Level** : ID, Libel
   - **Matiere** : ID, Nom

4. **Variables d'environnement :**
   ```bash
   GOOGLE_SHEETS_ID=<id du sheet>
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<email du compte service>
   GOOGLE_SERVICE_ACCOUNT_KEY=<clé privée avec \n échappés>
   ```

L'API tentera d'abord de lire le Sheet, sinon elle retombera sur `data/questions.json`.

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
   - Largeur: 1920
   - Hauteur: 200 (ajustez selon vos besoins)
   - Custom CSS: (optionnel, le fond est déjà transparent)

2. **Positionnez l'élément** où vous le souhaitez dans la scène

3. **Cliquez sur le Web-Hook Interactions** pour autoriser OBS

---

## API Documentation

### Endpoints disponibles

Tous les endpoints (sauf `/health`) requièrent l'en-tête `X-API-Key`.

#### Questions

- `GET /random?levelId=X&categoryId=Y&themeId=Z` - Question aléatoire avec filtres optionnels
- `GET /levels` - Liste des niveaux de difficulté
- `GET /categories` - Liste des catégories
- `GET /themes?categoryId=X` - Thèmes d'une catégorie

#### Synchronisation

- `POST /command` - Envoyer une commande (admin → overlay)
- `GET /command` - Lire la dernière commande
- `POST /state` - Mettre à jour l'état de l'overlay
- `GET /state` - Lire l'état actuel

#### Santé

- `GET /health` - Vérifier que le serveur est actif (public)

#### Arrêt du serveur

- `POST /shutdown` - Arrêter le serveur (protégé par API Key)

### Format des Données

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
- [x] Authentification par clé API (`X-API-Key`)
- [x] Validation des données entrantes (validators.js)
- [x] Secrets en variables d'environnement
- [x] `.gitignore` configuré pour ignorer `.env`
- [x] Mode production vs développement
- [x] Error handling global sans révéler les détails

### Checklist avant production

- [ ] Définir `NODE_ENV=production`
- [ ] Définir `API_KEY` avec une clé forte
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
node -c api/server.js

# Tester l'API en local
curl -H "X-API-Key: $API_KEY" http://localhost:3000/health
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

# Vérifiez les dépendances
cd api
npm install

# Relancez en mode debug
$env:LOG_LEVEL='debug'
npm run dev
```

### OBS ne voit pas l'overlay

- Vérifiez l'URL dans la Browser Source de OBS
- Vérifiez que le serveur écoute (check `http://localhost:3000/health`)
- Essayez avec `http://localhost:3000/overlay` au lieu d'une URL `file://`

### Admin ne se synchro pas avec overlay

- Ouvrez la console du navigateur (F12)
- Cherchez les erreurs en rouge
- Vérifiez que le serveur tourne (check `/health`)
- Essayez en mode "développement" sans clé API d'abord

### Les données ne chargent pas

- Vérifiez que `data/questions.json` existe
- Vérifiez que le JSON est valide (utilisez https://jsonlint.com/)
- Activez le debug pour voir les logs : `LOG_LEVEL=debug npm run dev`

### Erreur : "Clé API invalide"

- Vérifiez que `X-API-Key` est envoyée dans les en-têtes
- En développement, assurez-vous que `API_KEY` n'est pas définie (optionnelle)

### Erreur : "CORS non autorisé"

- Vérifiez `ALLOWED_ORIGINS` dans `.env`
- Incluez le protocol complet (http:// ou https://)

### Google Sheets ne charge pas

- Le serveur retombe automatiquement sur `data/questions.json`
- Vérifiez les variables d'environnement
- Consultez les logs du serveur

---

## Changelog

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
- ✅ Authentification par clé API (`X-API-Key` en header)
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
Éditez `data/questions.json` ou utilisez Google Sheets

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

**Dernière mise à jour :** 26 janvier 2026  
**Version :** 1.2
