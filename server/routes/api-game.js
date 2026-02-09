/**
 * Routes API - Logique du jeu
 */

const express = require('express');
const router = express.Router();

/**
 * Crée les routes game avec accès au gameEngine et aux services
 * @param {object} deps - { gameEngine, dataStore, socketManager }
 */
function createGameRoutes(deps) {
  const { gameEngine, dataStore, socketManager } = deps;

  // GET /api/game/state - État complet du jeu
  router.get('/state', (req, res) => {
    res.json({ success: true, data: gameEngine.getState() });
  });

  // POST /api/game/select-question - Sélectionner une question
  router.post('/select-question', (req, res) => {
    try {
      const { questionId } = req.body;

      if (!questionId) {
        return res.status(400).json({ success: false, error: 'questionId requis' });
      }

      const question = (dataStore.questions || []).find(q => q.ID === parseInt(questionId, 10));
      if (!question) {
        return res.status(404).json({ success: false, error: 'Question introuvable' });
      }

      const state = gameEngine.selectQuestion(question);
      socketManager.broadcast('game:question-selected', state);
      socketManager.broadcastState(state);

      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/select-random - Sélectionner une question aléatoire
  router.post('/select-random', (req, res) => {
    try {
      const { theme, category, level, matiere, excludeAsked } = req.body;
      let questions = dataStore.questions || [];

      // Filtres
      if (theme) questions = questions.filter(q => q.IDTheme === parseInt(theme, 10));
      if (category) questions = questions.filter(q => q.categoryName === category);
      if (level) questions = questions.filter(q => q.levelName === level);
      if (matiere) questions = questions.filter(q => q.matiereName === matiere);

      // Exclure les questions déjà posées
      if (excludeAsked !== false) {
        questions = questions.filter(q => !gameEngine.wasQuestionAsked(q.ID));
      }

      if (questions.length === 0) {
        return res.status(404).json({ success: false, error: 'Aucune question disponible avec ces filtres' });
      }

      const randomIndex = Math.floor(Math.random() * questions.length);
      const question = questions[randomIndex];

      const state = gameEngine.selectQuestion(question);
      socketManager.broadcast('game:question-selected', state);
      socketManager.broadcastState(state);

      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/reveal-answer - Révéler la bonne réponse
  router.post('/reveal-answer', (req, res) => {
    try {
      const state = gameEngine.revealAnswer();
      socketManager.broadcast('game:answer-revealed', state);
      socketManager.broadcastState(state);
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/validate-answer - Valider une réponse
  router.post('/validate-answer', (req, res) => {
    try {
      const { propositionIndex } = req.body;

      if (propositionIndex === undefined || propositionIndex === null) {
        return res.status(400).json({ success: false, error: 'propositionIndex requis' });
      }

      const state = gameEngine.validateAnswer(parseInt(propositionIndex, 10));
      socketManager.broadcast('game:answer-validated', state);
      socketManager.broadcastState(state);
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/update-score - Mettre à jour le score
  router.post('/update-score', (req, res) => {
    try {
      const { playerName, delta } = req.body;

      if (!playerName) {
        return res.status(400).json({ success: false, error: 'playerName requis' });
      }

      const state = gameEngine.updateScore(playerName, parseInt(delta, 10) || 0);
      socketManager.broadcast('game:score-updated', state);
      socketManager.broadcastState(state);
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/next - Passer à l'étape suivante
  router.post('/next', (req, res) => {
    try {
      const state = gameEngine.next();
      socketManager.broadcastState(state);
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/show-scores - Afficher le tableau des scores
  router.post('/show-scores', (req, res) => {
    try {
      const state = gameEngine.showScores();
      socketManager.broadcast('game:screen-changed', state);
      socketManager.broadcastState(state);
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/set-screen - Changer l'écran affiché
  router.post('/set-screen', (req, res) => {
    try {
      const { screen } = req.body;

      if (!screen) {
        return res.status(400).json({ success: false, error: 'screen requis' });
      }

      const state = gameEngine.setScreen(screen);
      socketManager.broadcast('game:screen-changed', state);
      socketManager.broadcastState(state);
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/reset - Réinitialiser le jeu
  router.post('/reset', (req, res) => {
    try {
      gameEngine.reset();
      const state = gameEngine.getState();
      socketManager.broadcast('game:reset', state);
      socketManager.broadcastState(state);
      res.json({ success: true, data: state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = createGameRoutes;
