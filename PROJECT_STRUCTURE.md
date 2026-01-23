# Structure du Projet Améliorée

```
Interface OBS Jeu/
├── README.md                          # Documentation principale
├── QUICK_START.md                     # Guide de démarrage rapide ⭐ COMMENCER PAR LÀ
├── API_DOCUMENTATION.md               # Documentation API complète
├── SECURITY_CHECKLIST.md              # Checklist de sécurité et bonnes pratiques
├── .env.example                       # Template des variables d'environnement
├── .gitignore                         # Fichiers à ignorer dans git
│
├── api/                               # 🔧 SERVEUR BACKEND
│   ├── server.js                      # Point d'entrée (refactorisé)
│   ├── config.js                      # ⭐ Configuration centralisée
│   ├── logger.js                      # ⭐ Logger réutilisable
│   ├── validators.js                  # ⭐ Validation des données
│   ├── package.json                   # Dépendances Node.js
│   ├── .env.example                   # Variables d'environnement
│   └── .env                           # (Ignoré par git)
│
├── overlay/                           # 👁️ AFFICHAGE OBS
│   ├── index.html                     # Page d'affichage
│   ├── script.js                      # Logique (améliorée avec API_KEY)
│   ├── style.css                      # Styles
│   ├── sync-manager.js                # ⭐ Gestionnaire de synchronisation unifié
│   ├── script.js.backup               # Sauvegarde
│   ├── audio/                         # Ressources audio
│   │   ├── 30secondes.wav
│   │   ├── correct.wav
│   │   ├── wrong.wav
│   │   └── select.wav
│   └── image/                         # Ressources images
│       └── logo.png
│
├── admin/                             # 👨‍💼 PANNEAU CONTRÔLE
│   ├── admin.html                     # Interface admin
│   └── admin.js                       # Logique (améliorée avec API_KEY)
│
└── data/                              # 📊 DONNÉES
    ├── questions.json                 # Questions locales (avec validation)
    ├── levels.json                    # Niveaux de difficulté
    ├── categories.json                # Catégories
    ├── themes.json                    # Thèmes
```

## 📦 Amélioration du serveur API

### Structure interne recommandée (future)

```
api/
├── server.js                   # Point d'entrée
├── config.js                   # Configuration
├── logger.js                   # Logging
├── validators.js               # Validation
│
├── middleware/                 # Middlewares Express
│   ├── auth.js                # Authentification API Key
│   ├── errorHandler.js        # Gestion d'erreurs
│   └── cors.js                # Configuration CORS
│
├── routes/                     # Routes groupées
│   ├── questions.js           # GET /random, /levels, /categories, /themes
│   ├── sync.js                # POST/GET /command, /state
│   └── health.js              # GET /health
│
├── services/                   # Logique métier
│   ├── sheetsService.js       # Intégration Google Sheets
│   ├── questionsService.js    # Gestion des questions
│   └── syncService.js         # Gestion de la synchronisation
│
└── tests/                      # Tests
    ├── unit/
    ├── integration/
    └── fixtures/
```

## 🔄 Flux de données

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
           │ ou BroadcastChannel
           ▼
┌─────────────────────────────────────────┐
│       Overlay (OBS Browser Source)      │
│  - Affichage question                   │
│  - Animations timer                     │
│  - Sélection réponses                   │
│  - Sons                                 │
└─────────────────────────────────────────┘
```

## 🔐 Chaîne de sécurité

```
Client (admin/overlay)
    ↓
    ├─ localStorage: quiz-api-key
    ├─ Crée header: X-API-Key
    ↓
Réseau
    ↓
Serveur API
    ├─ CORS (whitelist origins)
    ├─ validateApiKey (middleware)
    ├─ validateCommand/validateOverlayState (validators)
    ├─ Logging (logger)
    ├─ Error handling (middleware)
    ↓
    └─ OK: Traiter commande
       NON: Retourner 401/403/400
```

## 📈 Étapes de refactoring complétées

✅ **Phase 1: Sécurité**
- CORS restreint
- API Key
- Validation des données

✅ **Phase 2: Architecture**
- Config centralisée
- Logger
- Validators
- Error handling global

✅ **Phase 3: Synchronisation**
- SyncManager unifié
- Timestamps pour éviter doublons
- Logging des opérations

✅ **Phase 4: Documentation**
- README amélioré
- API_DOCUMENTATION
- QUICK_START
- SECURITY_CHECKLIST

⏳ **Phase 5: Tests** (futur)
- Tests unitaires
- Tests d'intégration
- Tests de performance

⏳ **Phase 6: Optimisation** (futur)
- WebSockets (au lieu du polling)
- Cache Redis
- Compression
- CDN pour les assets statiques

---

**Notes de transition**

- Les fichiers `overlay/script.js` et `admin/admin.js` ont été améliorés mais conservent leur API existante
- Vous pouvez progressivement remplacer le polling par `SyncManager` sans casser l'existant
- La clé API est optionnelle en développement (si `API_KEY` non définie)
