# Pourquoi la Clé API est nécessaire en production ?

## 🔒 Problème sans clé API

Sans clé API en production, **n'importe qui sur Internet** pourrait :

### 1. **Arrêter votre serveur** 🛑
```bash
# N'importe qui pourrait faire :
curl -X POST http://votre-serveur.com:3000/shutdown
```
→ Votre serveur s'arrête immédiatement, votre stream est interrompu !

### 2. **Envoyer des commandes malveillantes** ⚠️
```bash
# Quelqu'un pourrait envoyer des commandes à votre overlay :
curl -X POST http://votre-serveur.com:3000/command \
  -H "Content-Type: application/json" \
  -d '{"type": "LOAD_QUESTION", "question": {...}}'
```
→ Des personnes malveillantes pourraient contrôler votre overlay pendant votre stream !

### 3. **Modifier l'état de l'overlay** 🔧
```bash
# Quelqu'un pourrait modifier l'état :
curl -X POST http://votre-serveur.com:3000/state \
  -H "Content-Type: application/json" \
  -d '{"question": null, "timer": 0}'
```
→ Votre overlay pourrait être désynchronisé ou cassé !

### 4. **Lire les commandes sensibles** 👁️
```bash
# Quelqu'un pourrait espionner vos commandes :
curl http://votre-serveur.com:3000/command
```
→ Des personnes pourraient voir ce que vous préparez avant que ce soit affiché !

## ✅ Solution : La Clé API

La clé API est comme un **mot de passe secret** que seuls vous et votre application connaissez.

### Endpoints protégés

Ces endpoints **nécessitent** la clé API en production :

| Endpoint | Méthode | Protection | Risque sans protection |
|----------|---------|-----------|------------------------|
| `/shutdown` | POST | 🔒 API Key | Arrêt du serveur |
| `/command` | POST | 🔒 API Key | Envoi de commandes malveillantes |
| `/command` | GET | 🔒 API Key | Espionnage des commandes |
| `/state` | POST | 🔒 API Key | Modification de l'état |
| `/state` | GET | 🔒 API Key | Lecture de l'état |

### Endpoints publics (sans protection)

Ces endpoints restent accessibles à tous (c'est normal) :

| Endpoint | Méthode | Protection | Pourquoi public ? |
|----------|---------|-----------|-------------------|
| `/health` | GET | 🌐 Public | Vérification que le serveur fonctionne |
| `/overlay` | GET | 🌐 Public | Affichage dans OBS (lecture seule) |
| `/admin` | GET | 🌐 Public | Interface admin (mais les actions nécessitent la clé) |
| `/random` | GET | 🔒 API Key | Questions sensibles |
| `/levels` | GET | 🔒 API Key | Données sensibles |
| `/categories` | GET | 🔒 API Key | Données sensibles |
| `/themes` | GET | 🔒 API Key | Données sensibles |

## 🔐 Comment ça fonctionne ?

### 1. Configuration

Dans votre fichier `api/.env` :
```env
NODE_ENV=production
API_KEY=ma-super-cle-secrete-12345
```

### 2. Utilisation côté client

L'admin et l'overlay envoient la clé dans l'en-tête HTTP :

```javascript
// Dans admin.js et overlay/script.js
const headers = {
  'X-API-Key': 'ma-super-cle-secrete-12345'
};

fetch('http://localhost:3000/command', {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(command)
});
```

### 3. Vérification côté serveur

Le serveur vérifie la clé avant d'autoriser l'accès :

```javascript
// Dans api/server.js
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({ 
      error: 'Clé API invalide ou manquante' 
    });
  }
  
  next(); // Autoriser la requête
};
```

## 🎯 En pratique

### Mode Développement (localhost)
- ✅ Clé API **optionnelle** pour faciliter le développement
- ✅ Toutes les requêtes sont acceptées
- ⚠️ **Ne pas utiliser en production !**

### Mode Production
- 🔒 Clé API **obligatoire**
- 🔒 Toutes les requêtes sans clé valide sont rejetées (401)
- ✅ Protection contre les accès non autorisés

## 📝 Configuration pour la production

### 1. Générer une clé API sécurisée

```bash
# Option 1 : Utiliser un générateur en ligne
# https://www.random.org/strings/

# Option 2 : Utiliser Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configurer le fichier .env

```env
NODE_ENV=production
API_KEY=votre-cle-secrete-generee
PORT=3000
ALLOWED_ORIGINS=http://votre-domaine.com,https://votre-domaine.com
```

### 3. Configurer l'overlay dans OBS

Dans OBS, pour la Browser Source de l'overlay :
- URL : `http://votre-serveur.com:3000/overlay?apiKey=votre-cle-secrete-generee`

**⚠️ Attention :** La clé sera visible dans l'URL. C'est acceptable car :
- L'overlay est en lecture seule
- Seules les commandes POST nécessitent la clé
- L'overlay ne peut pas arrêter le serveur

### 4. Configurer l'admin

L'admin récupère la clé depuis `localStorage` ou vous pouvez la passer en paramètre d'URL :
- URL : `http://votre-serveur.com:3000/admin?apiKey=votre-cle-secrete-generee`

## 🚨 Bonnes pratiques

1. **Ne jamais commiter la clé API** dans Git
   - ✅ Utiliser `.env` (déjà dans `.gitignore`)
   - ❌ Ne pas mettre la clé dans le code source

2. **Utiliser une clé différente** pour chaque environnement
   - Développement : pas de clé (ou clé de test)
   - Production : clé forte et unique

3. **Changer la clé régulièrement** en cas de compromission suspectée

4. **Ne pas partager la clé** publiquement
   - Ne pas la mettre dans des screenshots
   - Ne pas la partager dans des messages publics

## 📊 Comparaison

| Aspect | Sans Clé API | Avec Clé API |
|--------|--------------|--------------|
| **Sécurité** | ❌ Vulnérable | ✅ Protégé |
| **Arrêt serveur** | ❌ N'importe qui peut arrêter | ✅ Seulement avec la clé |
| **Commandes** | ❌ N'importe qui peut envoyer | ✅ Seulement avec la clé |
| **Stream** | ❌ Risque d'interruption | ✅ Protégé |
| **Complexité** | ✅ Plus simple | ⚠️ Légèrement plus complexe |

## 🎓 Conclusion

La clé API est **essentielle en production** pour :
- 🔒 Protéger votre serveur contre les attaques
- 🔒 Empêcher l'arrêt non autorisé du serveur
- 🔒 Contrôler qui peut envoyer des commandes
- 🔒 Sécuriser votre stream en direct

**En développement**, elle est optionnelle pour faciliter les tests.
**En production**, elle est **obligatoire** pour la sécurité.

---

**Dernière mise à jour :** février 2026
