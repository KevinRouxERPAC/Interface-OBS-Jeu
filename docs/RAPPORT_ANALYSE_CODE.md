# 📋 Rapport d'Analyse du Code - Quiz Overlay OBS

**Date :** 26 janvier 2026  
**Version analysée :** 1.1.0  
**Statut :** ✅ Code fonctionnel avec améliorations recommandées

---

## 🎯 Résumé Exécutif

Le projet est **globalement bien structuré** avec une architecture modulaire et une sécurité de base en place. Cependant, plusieurs améliorations sont recommandées pour renforcer la robustesse, la maintenabilité et la qualité du code.

**Score global :** 7.5/10

---

## 🔴 Problèmes Critiques (À corriger en priorité)

### 1. **Code mort : `sync-manager.js` non utilisé**
- **Fichier :** `overlay/sync-manager.js`
- **Problème :** Le fichier existe mais n'est jamais importé/utilisé dans `overlay/script.js` ni `admin/admin.js`
- **Impact :** Code mort qui crée de la confusion
- **Solution :** Soit l'intégrer, soit le supprimer

### 2. **Gestion d'erreur insuffisante pour les fichiers JSON**
- **Fichiers :** `api/server.js` (lignes 118, 231, 257, 289)
- **Problème :** `JSON.parse()` sans try/catch - peut crasher le serveur si JSON corrompu
- **Impact :** Crash serveur en production
- **Solution :** Ajouter try/catch et validation

```javascript
// ❌ ACTUEL
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));

// ✅ RECOMMANDÉ
try {
  const raw = fs.readFileSync(questionsPath, 'utf-8');
  const questions = JSON.parse(raw);
  if (!Array.isArray(questions)) throw new Error('Format invalide');
} catch (err) {
  logger.error('DATA', `Erreur chargement questions.json: ${err.message}`);
  return [];
}
```

### 3. **Filtrage des questions par levelId incorrect**
- **Fichier :** `api/server.js` ligne 315
- **Problème :** Compare `q.niveau === levelId` mais `niveau` est un nom (string) et `levelId` est un ID
- **Impact :** Le filtrage ne fonctionne pas correctement
- **Solution :** Utiliser `q.idLevel` uniquement

```javascript
// ❌ ACTUEL
if (levelId) {
  questions = questions.filter(q => {
    return q.niveau === levelId || q.idLevel === levelId;
  });
}

// ✅ RECOMMANDÉ
if (levelId) {
  questions = questions.filter(q => q.idLevel === levelId);
}
```

### 4. **URLs audio dépendantes de l'API**
- **Fichier :** `overlay/script.js` lignes 537, 551
- **Problème :** Les sons utilisent `${CONFIG.apiUrl}/overlay/audio/` - ne fonctionne pas si API non lancée
- **Impact :** Pas de sons en mode local (sans serveur)
- **Solution :** Fallback vers chemins relatifs

```javascript
// ✅ RECOMMANDÉ
const audioUrl = CONFIG.apiUrl 
  ? `${CONFIG.apiUrl}/overlay/audio/${soundFile}`
  : `audio/${soundFile}`;
```

### 5. **Validation des données JSON absente au chargement**
- **Fichiers :** Tous les endpoints `/levels`, `/categories`, `/themes`
- **Problème :** Pas de validation que les données JSON respectent le schéma attendu
- **Impact :** Erreurs runtime si structure incorrecte
- **Solution :** Ajouter validation avec `validators.js`

---

## 🟡 Problèmes Importants (À améliorer)

### 6. **Timeouts hardcodés**
- **Fichier :** `admin/admin.js` lignes 419, 448
- **Problème :** `setTimeout(..., 3000)` hardcodé - pas configurable
- **Impact :** Difficile à ajuster sans modifier le code
- **Solution :** Déplacer dans CONFIG

```javascript
// ✅ RECOMMANDÉ
const CONFIG = {
  // ...
  selectionDisplayDelay: 3000, // ms
};
```

### 7. **Pas de validation des IDs dans les requêtes**
- **Fichier :** `api/server.js` lignes 266, 303
- **Problème :** `req.query.categoryId` et `req.query.themeId` utilisés sans validation
- **Impact :** Injection potentielle, erreurs si ID invalide
- **Solution :** Valider format des IDs

```javascript
// ✅ RECOMMANDÉ
const categoryId = req.query.categoryId;
if (categoryId && !/^[a-zA-Z0-9_-]+$/.test(categoryId)) {
  return res.status(400).json({ error: 'ID de catégorie invalide' });
}
```

### 8. **Gestion d'erreur réseau insuffisante côté client**
- **Fichiers :** `overlay/script.js`, `admin/admin.js`
- **Problème :** Erreurs réseau silencieuses ou mal gérées
- **Impact :** Expérience utilisateur dégradée
- **Solution :** Retry logic, meilleurs messages d'erreur

### 9. **Incohérence des types d'ID**
- **Fichiers :** `data/levels.json`, `data/categories.json`
- **Problème :** IDs sont des strings (`"1"`, `"2"`) mais comparés comme nombres potentiellement
- **Impact :** Bugs de comparaison
- **Solution :** Standardiser (toujours strings ou toujours numbers)

### 10. **Pas de rate limiting**
- **Fichier :** `api/server.js`
- **Problème :** Aucune protection contre le spam de requêtes
- **Impact :** Vulnérable aux attaques DoS
- **Solution :** Ajouter `express-rate-limit`

---

## 🟢 Améliorations Recommandées (Nice to have)

### 11. **Configuration manquante dans `.env.example`**
- **Fichier :** `.env.example`
- **Problème :** Ne contient pas toutes les variables utilisées dans `config.js`
- **Impact :** Confusion lors de la configuration
- **Solution :** Ajouter `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS`, `LOG_LEVEL`

### 12. **Pas de tests**
- **Problème :** Aucun test unitaire ou d'intégration
- **Impact :** Risque de régression, difficulté à refactorer
- **Solution :** Ajouter Jest + tests de base

### 13. **Pas de linter/formatter**
- **Problème :** Pas de ESLint/Prettier configuré
- **Impact :** Incohérences de style, erreurs potentielles non détectées
- **Solution :** Ajouter ESLint + Prettier

### 14. **Pas de JSDoc**
- **Problème :** Fonctions non documentées
- **Impact :** Difficulté à comprendre le code pour nouveaux développeurs
- **Solution :** Ajouter JSDoc sur fonctions publiques

### 15. **Variables magiques**
- **Fichiers :** Multiple
- **Problème :** Valeurs hardcodées (500ms, 30s, etc.)
- **Impact :** Code moins maintenable
- **Solution :** Extraire dans CONFIG

### 16. **Gestion des erreurs Google Sheets**
- **Fichier :** `api/server.js` lignes 141-216
- **Problème :** Erreurs Sheets peuvent être silencieuses
- **Impact :** Fallback JSON peut ne pas se déclencher
- **Solution :** Meilleure gestion d'erreur avec logging

### 17. **Pas de validation de schéma pour les données**
- **Fichier :** `data/*.json`
- **Problème :** Pas de validation que les JSON respectent le schéma
- **Impact :** Erreurs runtime
- **Solution :** Ajouter validation avec JSON Schema ou validators

### 18. **Polling interval non configurable**
- **Fichier :** `overlay/script.js` ligne 16
- **Problème :** `pollInterval: 500` hardcodé
- **Impact :** Pas d'ajustement selon performance
- **Solution :** Rendre configurable

### 19. **Pas de gestion de reconnexion automatique**
- **Fichiers :** `overlay/script.js`, `admin/admin.js`
- **Problème :** Si connexion perdue, pas de retry automatique
- **Impact :** Nécessite rechargement manuel
- **Solution :** Implémenter retry logic avec backoff exponentiel

### 20. **Logs côté client trop verbeux en production**
- **Fichiers :** `overlay/script.js`, `admin/admin.js`
- **Problème :** `console.log` partout - pas de niveau de log
- **Impact :** Performance, sécurité (infos sensibles)
- **Solution :** Logger conditionnel basé sur environnement

---

## 📊 Métriques de Qualité

### Code Coverage
- **Tests :** 0% (aucun test)
- **Documentation :** 60% (bonne mais manque JSDoc)
- **Linting :** 0% (pas de linter configuré)

### Complexité
- **Fichiers les plus complexes :**
  1. `api/server.js` (379 lignes) - ⚠️ À diviser en routes
  2. `admin/admin.js` (604 lignes) - ⚠️ À diviser en modules
  3. `overlay/script.js` (586 lignes) - ⚠️ À diviser en modules

### Dépendances
- ✅ Toutes à jour
- ✅ Pas de vulnérabilités connues (à vérifier avec `npm audit`)

---

## 🎯 Plan d'Action Recommandé

### Phase 1 : Corrections Critiques (1-2 jours)
1. ✅ Corriger le filtrage `levelId`
2. ✅ Ajouter try/catch pour JSON.parse
3. ✅ Fixer les URLs audio avec fallback
4. ✅ Supprimer ou intégrer `sync-manager.js`

### Phase 2 : Améliorations Importantes (3-5 jours)
5. ✅ Extraire timeouts dans CONFIG
6. ✅ Valider les IDs dans les requêtes
7. ✅ Améliorer gestion d'erreur réseau
8. ✅ Standardiser types d'ID
9. ✅ Ajouter rate limiting

### Phase 3 : Qualité de Code (1 semaine)
10. ✅ Compléter `.env.example`
11. ✅ Ajouter tests de base
12. ✅ Configurer ESLint + Prettier
13. ✅ Ajouter JSDoc
14. ✅ Extraire variables magiques

### Phase 4 : Optimisations (optionnel)
15. ✅ Améliorer gestion erreurs Google Sheets
16. ✅ Ajouter validation schéma JSON
17. ✅ Implémenter reconnexion automatique
18. ✅ Logger conditionnel côté client

---

## ✅ Points Positifs

Le projet a déjà de **bonnes pratiques** en place :

- ✅ Architecture modulaire (config.js, logger.js, validators.js)
- ✅ Sécurité de base (CORS, API Key, validation)
- ✅ Documentation complète
- ✅ Gestion d'erreur globale Express
- ✅ Code bien commenté
- ✅ Structure de projet claire
- ✅ Docker ready
- ✅ Scripts de démarrage

---

## 📝 Conclusion

Le code est **fonctionnel et bien structuré** mais nécessite des améliorations pour être **production-ready** à 100%. Les problèmes critiques doivent être corrigés en priorité, puis les améliorations importantes pour renforcer la robustesse.

**Priorité :** Corriger les 5 problèmes critiques avant tout déploiement en production.

---

*Rapport généré automatiquement - 26 janvier 2026*
