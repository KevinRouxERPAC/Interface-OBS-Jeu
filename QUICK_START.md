# Guide de Démarrage Rapide

## ⚡ 30 secondes pour tester

### Sans serveur (mode local)
```bash
# 1. Ouvrez dans OBS Browser Source :
file:///C:/Users/kevin/Documents/Interface OBS Jeu/overlay/index.html

# 2. Ouvrez en parallèle dans le navigateur :
file:///C:/Users/kevin/Documents/Interface OBS Jeu/admin/admin.html

# ✅ Prêt ! Les données viennent de data/questions.json
```

## 🚀 Avec serveur API (recommandé)

### Installation
```bash
cd "Interface OBS Jeu\api"
npm install
```

### Démarrage
```bash
# Développement
npm run dev

# Production
npm start
```

### Vérifier que ça marche
```bash
# Le serveur écoute sur http://localhost:3000
# Testez avec :
curl http://localhost:3000/health
# Doit retourner : {"status":"ok","timestamp":"..."}
```

### Utiliser dans OBS/navigateur
```
http://localhost:3000/overlay
http://localhost:3000/admin
```

## 🔐 Ajouter une clé API (optionnel en dev)

### 1. Générez une clé secrète
```bash
# Sous PowerShell :
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Count 32 | ForEach-Object { [char]$_ }))) -Replace '\s'
# Ou utilisez n'importe quelle chaîne longue et sécurisée
```

### 2. Configurez l'API
```bash
# Éditez api\.env
API_KEY=votre-clé-très-secrète
NODE_ENV=production
```

### 3. Utilisez la clé dans l'overlay/admin
```javascript
// Dans la console du navigateur :
localStorage.setItem('quiz-api-key', 'votre-clé-très-secrète');

// Recharger la page
```

## 📊 Ajouter vos questions

### Méthode 1 : JSON local (rapide)
Éditez `data/questions.json` :
```json
[
  {
    "id": 1,
    "question": "Votre question ?",
    "propositions": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
    "bonneReponse": 0,
    "explication": "Pourquoi c'est A",
    "theme": "Géographie",
    "matiere": "Sciences",
    "niveau": "Collège",
    "duration": 30
  }
]
```

### Méthode 2 : Google Sheets (recommandé pour les équipes)
1. Créez une Google Sheet avec la structure prévue
2. Configurez les variables `GOOGLE_SHEETS_*` dans `.env`
3. Relancez le serveur

L'API cherche d'abord Google Sheets, puis retombe sur le JSON local.

## 🎯 Commandes principales

Depuis le panneau admin :

| Bouton | Action |
|--------|--------|
| "Nouvelle question" | Lance une question aléatoire |
| "Nouvelle sélection" | Affiche menu niveau/catégorie/thème |
| "Révéler la réponse" | Affiche la bonne réponse en surbrillance |
| "Relancer le timer" | Remet le chrono à zéro |
| A, B, C, D | Sélectionne la réponse |

## 🐛 Ça ne marche pas ?

### Le serveur ne démarre pas
```bash
# Vérifiez que Node.js est installé
node --version

# Vérifiez les dépendances
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

## 📱 Configuration OBS

1. **Créez une Browser Source**
   - URL: `http://localhost:3000/overlay`
   - Largeur: 1920
   - Hauteur: 200 (ajustez selon vos besoins)
   - Custom CSS: (optionnel, le fond est déjà transparent)

2. **Positionnez l'élément** où vous le souhaitez dans la scène

3. **Cliquez sur le Web-Hook Interactions** pour autoriser OBS

## 💡 Astuces

- **Pour changer la durée du timer** : Éditez le champ durée dans le JSON ou cliquez le bouton "Relancer le timer"
- **Pour développer** : Utilisez `LOG_LEVEL=debug` pour voir tout ce qui se passe
- **Pour déboguer OBS** : Inspectez la browser source avec `Ctrl+Shift+I` pour voir les logs JavaScript
- **Pour éviter les doublons questions** : Assurez-vous que chaque question a un ID unique

## 📚 Documentation complète

Voir [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

**Questions ?** Regardez les fichiers `.js` commentés ou ouvrez un issue !
