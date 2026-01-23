# Quiz Overlay pour OBS - Documentation Complète

Overlay HTML/CSS/JS façon jeu TV + panneau admin léger pour piloter les questions, le timer et la révélation des réponses. Compatible avec une source navigateur OBS (fond transparent).

## 🆕 Améliorations Apportées (v1.1)

✅ **Sécurité renforcée**
- CORS restreint à des origines autorisées
- Authentification par clé API (`X-API-Key`)
- Validation stricte des données entrantes
- Mode développement / production

✅ **Code et architecture améliorés**
- Logger centralisé avec niveaux configurables
- Validators réutilisables pour les données
- Configuration externalisée (`.env`)
- Error handling global dans l'API

✅ **Synchronisation consolid**
- `SyncManager` unifié pour BroadcastChannel, localStorage et polling
- Timestamps pour éviter les doublons
- Logging des opérations

✅ **Documentation**
- Fichier `.env.example` fourni
- `.gitignore` configuré
- `package.json` complété avec métadonnées

## Structure

- **overlay/** : fichiers affichés dans la source navigateur OBS
- **admin/** : panneau de contrôle (ouvrir dans un navigateur)
- **api/** : serveur Node.js (synchronisation + questions)
- **data/** : banque de questions (JSON ou Google Sheets)

## 🚀 Lancer le projet

### Option 1 : Sans API (simple)

1. Ouvrez `overlay/index.html` dans OBS via une Browser Source
2. Ouvrez `admin/admin.html` dans votre navigateur
3. Les données utilisent `data/questions.json` en local

### Option 2 : Avec API serveur

1. **Installez les dépendances**
   ```bash
   cd api
   npm install
   ```

2. **Configurez les variables d'environnement**
   ```bash
   # Copiez le fichier d'exemple
   cp .env.example .env
   
   # Éditez .env avec vos paramètres
   ```

3. **Lancez le serveur**
   ```bash
   npm start           # Production
   npm run dev         # Développement
   ```

4. L'API écoute sur le port configuré (par défaut `3000`)

## 🔐 Configuration de la Clé API

### En développement
La clé API est optionnelle si elle n'est pas définie dans `.env`.

### En production
La clé API est **requise**. Définissez dans `.env`:
```bash
API_KEY=votre-clé-secrète-très-longue
NODE_ENV=production
```

### Utilisation depuis l'overlay/admin
Les clés API sont automatiquement envoyées via le header `X-API-Key` si stockées dans `localStorage` :
```javascript
localStorage.setItem('quiz-api-key', 'votre-clé');
```

## 📝 Configuration du Serveur

### Variables d'environnement (`.env`)

```bash
# Serveur
PORT=3000
NODE_ENV=development

# Authentification
API_KEY=your-api-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000

# Google Sheets (optionnel)
GOOGLE_SHEETS_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_KEY=...

# Logging
LOG_LEVEL=info  # error, warn, info, debug
```

## 🎯 Endpoints API

Tous les endpoints (sauf `/health`) requièrent l'en-tête `X-API-Key`.

### Questions
- `GET /random?levelId=X&categoryId=Y&themeId=Z` - Question aléatoire avec filtres optionnels
- `GET /levels` - Liste des niveaux de difficulté
- `GET /categories` - Liste des catégories
- `GET /themes?categoryId=X` - Thèmes d'une catégorie

### Synchronisation
- `POST /command` - Envoyer une commande (admin → overlay)
- `GET /command` - Lire la dernière commande
- `POST /state` - Mettre à jour l'état de l'overlay
- `GET /state` - Lire l'état actuel

### Santé
- `GET /health` - Vérifier que le serveur est actif (public)

## 📊 Format des Données

### Question
```json
{
  "id": 1,
  "question": "Question texte ?",
  "propositions": ["A", "B", "C", "D"],
  "bonneReponse": 2,
  "explication": "Explication...",
  "theme": "Géographie",
  "matiere": "Sciences",
  "niveau": "Collège",
  "duration": 30
}
```

### Commande
```json
{
  "type": "LAUNCH_QUESTION",
  "levelId": "1",
  "categoryId": "5",
  "themeId": "10"
}
```

### État de l'overlay
```json
{
  "question": { /* objet question */ },
  "timer": 15,
  "selectedIndex": 2,
  "timestamp": 1234567890
}
```

## 🔗 Option Google Sheets

### Préalables
1. Créez un projet Google Cloud
2. Activez "Google Sheets API"
3. Créez un compte de service et téléchargez la clé JSON
4. Partagez votre feuille avec l'email du compte de service

### Structure attendue du Sheets
5 onglets avec les en-têtes :
- **Questions** : ID, IDTheme, IDLevel, Question, Right_Answer, Proposition1, Proposition2, Proposition3, Explications, Type_Question
- **Theme** : ID, IDCategory, Name, Description
- **Category** : ID, Name, Start_Date, End_Date, IDMatiere
- **Level** : ID, Libel
- **Matiere** : ID, Nom

### Configuration
```bash
# .env
GOOGLE_SHEETS_ID=<id du sheet>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<email du compte service>
GOOGLE_SERVICE_ACCOUNT_KEY=<clé privée avec \n échappés>
```

## 🎨 Personnalisation

- **Couleurs** : Modifiez les variables CSS dans `overlay/style.css`
- **Timer par défaut** : `DEFAULT_DURATION` dans `overlay/script.js`
- **Questions** : Éditez `data/questions.json` ou utilisez Google Sheets

## 🐛 Dépannage

### Erreur : "Clé API invalide"
- Vérifiez que `X-API-Key` est envoyée dans les en-têtes
- En développement, assurez-vous que `API_KEY` n'est pas définie (optionnelle)

### Erreur : "CORS non autorisé"
- Vérifiez `ALLOWED_ORIGINS` dans `.env`
- Incluez le protocol complet (http:// ou https://)

### Synchronisation ne fonctionne pas
- Si OBS, le polling serveur est utilisé (pas BroadcastChannel)
- Vérifiez que le serveur API écoute sur le bon port
- Vérifiez les logs du serveur (`LOG_LEVEL=debug`)

### Google Sheets ne charge pas
- Le serveur retombe automatiquement sur `data/questions.json`
- Vérifiez les variables d'environnement
- Consultez les logs du serveur

## 📦 Dépendances

- **Express** ^4.18.2 - Framework HTTP
- **CORS** ^2.8.5 - Gestion CORS
- **dotenv** ^16.4.5 - Variables d'environnement
- **googleapis** ^170.0.0 - Intégration Google Sheets

## 📄 Licence

MIT

## 🤝 Contribuer

Les pull requests sont bienvenues ! Assurez-vous que :
- Le code suit la structure existante
- Les secrets ne sont jamais committes (utiliser `.env`)
- Les erreurs sont loggées correctement
