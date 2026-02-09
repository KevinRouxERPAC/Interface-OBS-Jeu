/**
 * Routes API - Données (questions, thèmes, catégories, niveaux, matières)
 */

const express = require('express');
const router = express.Router();

/**
 * Crée les routes data avec accès au dataStore et aux services
 * @param {object} deps - { dataStore, googleSheets, cache, socketManager }
 */
function createDataRoutes(deps) {
  const { dataStore, googleSheets, cache, socketManager } = deps;

  // GET /api/data/questions - Toutes les questions (avec filtres optionnels)
  router.get('/questions', (req, res) => {
    try {
      let questions = dataStore.questions || [];

      // Filtres optionnels via query params
      const { theme, category, level, matiere, excludeAsked } = req.query;

      if (theme) {
        questions = questions.filter(q => q.IDTheme === parseInt(theme, 10));
      }
      if (category) {
        questions = questions.filter(q => q.categoryName === category);
      }
      if (level) {
        questions = questions.filter(q => q.levelName === level);
      }
      if (matiere) {
        questions = questions.filter(q => q.matiereName === matiere);
      }

      res.json({ success: true, count: questions.length, data: questions });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/data/questions/:id - Une question par ID
  router.get('/questions/:id', (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const question = (dataStore.questions || []).find(q => q.ID === id);

      if (!question) {
        return res.status(404).json({ success: false, error: 'Question introuvable' });
      }

      res.json({ success: true, data: question });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/data/themes
  router.get('/themes', (req, res) => {
    res.json({ success: true, data: dataStore.themes || [] });
  });

  // GET /api/data/categories
  router.get('/categories', (req, res) => {
    res.json({ success: true, data: dataStore.categories || [] });
  });

  // GET /api/data/levels
  router.get('/levels', (req, res) => {
    res.json({ success: true, data: dataStore.levels || [] });
  });

  // GET /api/data/matieres
  router.get('/matieres', (req, res) => {
    res.json({ success: true, data: dataStore.matieres || [] });
  });

  // POST /api/data/refresh - Recharger depuis Google Sheets
  router.post('/refresh', async (req, res) => {
    try {
      const data = await googleSheets.loadAllData();
      const enriched = googleSheets.resolveRelations(data);

      // Mettre à jour le dataStore
      Object.assign(dataStore, enriched);

      // Sauvegarder en cache
      cache.saveCache(enriched);

      // Notifier les clients
      socketManager.broadcast('data:refreshed', {
        timestamp: new Date().toISOString(),
        counts: {
          questions: enriched.questions.length,
          themes: enriched.themes.length,
          categories: enriched.categories.length,
          levels: enriched.levels.length,
          matieres: enriched.matieres.length,
        },
      });

      res.json({
        success: true,
        message: 'Données rechargées depuis Google Sheets',
        counts: {
          questions: enriched.questions.length,
          themes: enriched.themes.length,
          categories: enriched.categories.length,
          levels: enriched.levels.length,
          matieres: enriched.matieres.length,
        },
      });
    } catch (err) {
      console.error('[API] Erreur lors du rafraîchissement:', err.message);
      res.status(500).json({ success: false, error: `Erreur Google Sheets: ${err.message}` });
    }
  });

  // GET /api/data/status - État de la connexion Google Sheets
  router.get('/status', (req, res) => {
    const gsStatus = googleSheets.getStatus();
    const cacheInfo = cache.getCacheInfo();

    res.json({
      success: true,
      data: {
        googleSheets: gsStatus,
        cache: cacheInfo,
        counts: {
          questions: (dataStore.questions || []).length,
          themes: (dataStore.themes || []).length,
          categories: (dataStore.categories || []).length,
          levels: (dataStore.levels || []).length,
          matieres: (dataStore.matieres || []).length,
        },
      },
    });
  });

  return router;
}

module.exports = createDataRoutes;
