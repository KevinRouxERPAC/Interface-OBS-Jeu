# 📖 Guide de Navigation - Où Commencer ?

## 🆕 Vous découvrez ce projet ?

**→ Commencez par [QUICK_START.md](./QUICK_START.md)** ⭐

5 minutes pour avoir quelque chose qui fonctionne :
1. Installation (`npm install`)
2. Configuration (`.env.example` → `.env`)
3. Démarrage (`npm start`)
4. Test (`http://localhost:3000/health`)

## 👨‍💼 Vous êtes streamer/utilisateur ?

**→ Lisez [QUICK_START.md](./QUICK_START.md)**

Sections clés :
- "30 secondes pour tester" - Mode local sans serveur
- "Avec serveur API" - Configuration complète
- "Commandes principales" - Boutons et actions

## 👨‍💻 Vous êtes développeur ?

**→ Lisez par ordre de priorité:**

1. **[README.md](./README.md)** - Vue d'ensemble (2 min)
2. **[QUICK_START.md](./QUICK_START.md)** - Installation (5 min)
3. **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Endpoints et format (15 min)
4. **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - Architecture interne (10 min)
5. **[SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)** - Bonnes pratiques (10 min)

## 🔐 Vous gérez la sécurité ?

**→ Lisez [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)**

Sections importantes :
- "Sécurité" - Checklist de vérification
- "Déploiement" - Checklist avant production
- "Prochaines étapes" - Roadmap sécurité

## 🚀 Vous déployez en production ?

**→ Lisez par ordre:**

1. **[SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)** - Checklist déploiement
2. **[Dockerfile](./Dockerfile)** - Déploiement Docker
3. **[docker-compose.yml](./docker-compose.yml)** - Orchestration complète
4. **[QUICK_START.md](./QUICK_START.md)** - Section "Ajouter une clé API"

Étapes à suivre :
1. Mettre à jour `.env` avec les valeurs de production
2. Générer une clé API forte
3. Utiliser Docker ou le script `start.ps1`
4. Configurer un reverse proxy (nginx)
5. Activer HTTPS

## 📚 Vous cherchez une documentation spécifique ?

| Question | Document | Section |
|----------|----------|---------|
| Comment installer ? | [QUICK_START.md](./QUICK_START.md) | "Installation" |
| Quels sont les endpoints ? | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | "Endpoints API" |
| Comment fonctionnent les données ? | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | "Format des Données" |
| Comment utiliser Google Sheets ? | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | "Option Google Sheets" |
| Comment configurer les variables ? | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | "Configuration du Serveur" |
| Comment ajouter une clé API ? | [QUICK_START.md](./QUICK_START.md) | "Ajouter une clé API" |
| Comment utiliser Docker ? | [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | (voir Dockerfile) |
| Qu'a-t-il changé en v1.1 ? | [CHANGELOG.md](./CHANGELOG.md) | n/a |
| Quelles améliorations ? | [IMPROVEMENTS_SUMMARY.md](./IMPROVEMENTS_SUMMARY.md) | n/a |
| Pourquoi ces changements ? | [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) | n/a |

## 🎯 Cas d'usage courants

### "Je veux juste tester rapidement"
```bash
# 1. Ouvrir dans OBS (sans serveur) :
file:///C:/Users/kevin/Documents/Interface OBS Jeu/overlay/index.html

# 2. Ouvrer le contrôleur :
file:///C:/Users/kevin/Documents/Interface OBS Jeu/admin/admin.html

# 3. C'est prêt !
```
→ **Documentation:** [QUICK_START.md](./QUICK_START.md) - "Sans serveur"

### "Je veux utiliser le serveur localement"
```bash
cd api
npm install
npm run dev
# Puis http://localhost:3000/overlay et /admin
```
→ **Documentation:** [QUICK_START.md](./QUICK_START.md) - "Avec serveur API"

### "Je veux deployer en production"
1. Lire [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)
2. Configurer `.env` avec les secrets
3. Utiliser Docker : `docker-compose up`
4. Ajouter un reverse proxy (nginx)
5. Activer HTTPS (Let's Encrypt)

→ **Documentation:** [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - "Déploiement"

### "Je veux utiliser Google Sheets"
1. Créer un compte de service Google Cloud
2. Configurer `GOOGLE_SHEETS_*` dans `.env`
3. Le serveur charge les données depuis Sheets

→ **Documentation:** [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - "Option Google Sheets"

### "Je veux ajouter une clé API"
```javascript
// 1. Générer une clé : openssl rand -base64 32
// 2. Définir dans .env : API_KEY=ma-clé-secrète
// 3. Envoyer le header : X-API-Key: ma-clé-secrète
```
→ **Documentation:** [QUICK_START.md](./QUICK_START.md) - "Ajouter une clé API"

## 🔍 Fichiers clés du projet

| Fichier | Rôle | Modifié ? |
|---------|------|----------|
| `api/server.js` | Serveur principal | ✅ Refactorisé |
| `api/config.js` | Configuration centralisée | ✅ Nouveau |
| `api/logger.js` | Logging professionnel | ✅ Nouveau |
| `api/validators.js` | Validation des données | ✅ Nouveau |
| `overlay/script.js` | Logique affichage | ✅ Amélioré |
| `overlay/sync-manager.js` | Synchronisation | ✅ Nouveau |
| `admin/admin.js` | Logique contrôle | ✅ Amélioré |
| `data/questions.json` | Questions locales | ⬜ Inchangé |
| `.env.example` | Template variables | ✅ Nouveau |
| `.gitignore` | Sécurité git | ✅ Nouveau |

## 📞 Besoin d'aide ?

1. **Erreur lors du démarrage ?**
   → [QUICK_START.md](./QUICK_START.md) - "Ça ne marche pas ?"

2. **Problème de synchronisation ?**
   → [QUICK_START.md](./QUICK_START.md) - "Admin ne se synchro pas"

3. **Problème de sécurité ?**
   → [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - "Dépannage"

4. **Besoin d'un endpoint spécifique ?**
   → [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - "Endpoints API"

5. **Comment faire X ?**
   → Cherchez dans la table [ci-dessus](#-vous-cherchez-une-documentation-spécifique)

## ✅ Checklist pour commencer

- [ ] J'ai lu [README.md](./README.md)
- [ ] J'ai suivi [QUICK_START.md](./QUICK_START.md)
- [ ] Le serveur démarre sans erreur
- [ ] `http://localhost:3000/health` répond
- [ ] L'overlay affiche les questions
- [ ] L'admin contrôle les questions
- [ ] Je connais ma stratégie (local ou serveur)
- [ ] Mes secrets sont dans `.env` (pas dans le code)

## 🎓 Apprendre

Le projet contient :
- **~2000 lignes** de code documenté
- **~1500 lignes** de documentation complète
- **Exemples** dans chaque fichier
- **Commentaires** dans le code important

Commencez par [QUICK_START.md](./QUICK_START.md) et explorez progressivement !

---

**Questions ?** Regardez la documentation spécifique ou explorez le code - il est bien commenté !
