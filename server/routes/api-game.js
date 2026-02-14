/**
 * Routes API - Logique du jeu
 */

const express = require('express');
const router = express.Router();

const STEP_LABELS = {
  matiere: 'Matière',
  level: 'Difficulté',
  category: 'Catégorie',
  theme: 'Thème',
  question: 'Question',
};

/**
 * Calcule les options pour une étape de sélection
 */
function getSelectionOptions(step, dataStore, filters) {
  const { matiere, level, category } = filters;
  const themes = dataStore.themes || [];
  const categories = dataStore.categories || [];
  const levels = dataStore.levels || [];
  const matieres = dataStore.matieres || [];
  const questions = dataStore.questions || [];

  if (step === 'matiere') {
    const uniqueMatieres = matieres.length
      ? [...new Set(matieres.map(m => m.Nom).filter(Boolean))]
      : ['Histoire'];
    return uniqueMatieres.map(nom => ({ value: nom, label: nom }));
  }

  if (step === 'level') {
    let filteredThemes = themes;
    if (matiere) {
      filteredThemes = themes.filter(t => t.matiereName === matiere);
    }
    const levelIds = [...new Set(filteredThemes.map(t => t.IDLevel).filter(Boolean))];
    return levels
      .filter(l => levelIds.includes(l.ID))
      .map(l => ({ value: l.Libel, label: l.Libel }));
  }

  if (step === 'category') {
    let filteredThemes = themes;
    if (matiere) filteredThemes = filteredThemes.filter(t => t.matiereName === matiere);
    if (level) filteredThemes = filteredThemes.filter(t => t.levelName === level);
    const categoryIds = [...new Set(filteredThemes.map(t => t.IDCategory).filter(Boolean))];
    return categories
      .filter(c => categoryIds.includes(c.ID))
      .map(c => ({ value: c.Name, label: c.Name }));
  }

  return [];
}

/**
 * Construit l'objet steps pour selectionState
 */
function buildStepsPayload(dataStore, filters, stepResults) {
  const { matiere, level, category } = filters;
  const optionsMatiere = getSelectionOptions('matiere', dataStore, {});
  const optionsLevel = getSelectionOptions('level', dataStore, { matiere });
  const optionsCategory = getSelectionOptions('category', dataStore, { matiere, level });

  return {
    matiere: {
      label: STEP_LABELS.matiere,
      options: optionsMatiere,
      selected: stepResults.matiere ?? null,
    },
    level: {
      label: STEP_LABELS.level,
      options: optionsLevel,
      selected: stepResults.level ?? null,
    },
    category: {
      label: STEP_LABELS.category,
      options: optionsCategory,
      selected: stepResults.category ?? null,
    },
    theme: {
      label: STEP_LABELS.theme,
      options: [],
      selected: stepResults.theme ?? null,
    },
    question: {
      label: STEP_LABELS.question,
      options: [],
      selected: stepResults.question ?? null,
    },
  };
}

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

  // GET /api/game/selection-options - Options pour une étape de sélection
  router.get('/selection-options', (req, res) => {
    try {
      const { step, matiere, level, category } = req.query;
      if (!step) {
        return res.status(400).json({ success: false, error: 'step requis' });
      }
      const options = getSelectionOptions(step, dataStore, { matiere, level, category });
      res.json({ success: true, data: { options } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/game/selection-step - Enregistre un choix ou tire au sort (thème/question)
  router.post('/selection-step', (req, res) => {
    try {
      const { step, selected } = req.body;
      if (!step) {
        return res.status(400).json({ success: false, error: 'step requis' });
      }

      const currentState = gameEngine.getState();
      const prevSelection = currentState.selectionState || {};
      const prevSteps = prevSelection.steps || {};
      const filters = {
        matiere: prevSteps.matiere?.selected ?? req.body.matiere ?? null,
        level: prevSteps.level?.selected ?? req.body.level ?? null,
        category: prevSteps.category?.selected ?? req.body.category ?? null,
      };

      const stepResults = {
        matiere: prevSteps.matiere?.selected ?? null,
        level: prevSteps.level?.selected ?? null,
        category: prevSteps.category?.selected ?? null,
        theme: prevSteps.theme?.selected ?? null,
        question: prevSteps.question?.selected ?? null,
      };

      if (step === 'matiere') {
        stepResults.matiere = selected ?? null;
        const nextStep = 'level';
        const steps = buildStepsPayload(dataStore, {}, stepResults);
        steps.level.options = getSelectionOptions('level', dataStore, { matiere: stepResults.matiere });
        const selectionState = { currentStep: nextStep, steps };
        gameEngine.setSelectionState(selectionState);
        socketManager.broadcast('game:selection-step', gameEngine.getState());
        socketManager.broadcastState(gameEngine.getState());
        return res.json({ success: true, data: gameEngine.getState() });
      }

      if (step === 'level') {
        stepResults.level = selected ?? null;
        const nextStep = 'category';
        const steps = buildStepsPayload(dataStore, { matiere: stepResults.matiere }, stepResults);
        steps.category.options = getSelectionOptions('category', dataStore, { matiere: stepResults.matiere, level: stepResults.level });
        const selectionState = { currentStep: nextStep, steps };
        gameEngine.setSelectionState(selectionState);
        socketManager.broadcast('game:selection-step', gameEngine.getState());
        socketManager.broadcastState(gameEngine.getState());
        return res.json({ success: true, data: gameEngine.getState() });
      }

      if (step === 'category') {
        stepResults.category = selected ?? null;
        const nextStep = 'theme';
        const steps = buildStepsPayload(dataStore, filters, stepResults);
        const selectionState = { currentStep: nextStep, steps };
        gameEngine.setSelectionState(selectionState);
        socketManager.broadcast('game:selection-step', gameEngine.getState());
        socketManager.broadcastState(gameEngine.getState());
        return res.json({ success: true, data: gameEngine.getState() });
      }

      if (step === 'theme') {
        let themes = dataStore.themes || [];
        if (stepResults.matiere) themes = themes.filter(t => t.matiereName === stepResults.matiere);
        if (stepResults.level) themes = themes.filter(t => t.levelName === stepResults.level);
        if (stepResults.category) themes = themes.filter(t => t.categoryName === stepResults.category);
        if (themes.length === 0) {
          return res.status(404).json({ success: false, error: 'Aucun thème disponible avec ces filtres' });
        }
        const theme = themes[Math.floor(Math.random() * themes.length)];
        stepResults.theme = theme.Name;
        const steps = buildStepsPayload(dataStore, filters, stepResults);
        const selectionState = { currentStep: 'question', steps };
        gameEngine.setSelectionState(selectionState);
        socketManager.broadcast('game:selection-step', gameEngine.getState());
        socketManager.broadcastState(gameEngine.getState());
        return res.json({ success: true, data: gameEngine.getState() });
      }

      if (step === 'question') {
        let qList = dataStore.questions || [];
        if (stepResults.matiere) qList = qList.filter(q => q.matiereName === stepResults.matiere);
        if (stepResults.level) qList = qList.filter(q => q.levelName === stepResults.level);
        if (stepResults.category) qList = qList.filter(q => q.categoryName === stepResults.category);
        if (stepResults.theme) qList = qList.filter(q => q.themeName === stepResults.theme);
        qList = qList.filter(q => !gameEngine.wasQuestionAsked(q.ID));
        if (qList.length === 0) {
          return res.status(404).json({ success: false, error: 'Aucune question disponible' });
        }
        const question = qList[Math.floor(Math.random() * qList.length)];
        stepResults.question = question.Question;
        const steps = buildStepsPayload(dataStore, filters, stepResults);
        const lastSelectionState = { currentStep: 'question', steps };
        gameEngine.setSelectionState(lastSelectionState);
        socketManager.broadcast('game:selection-step', gameEngine.getState());
        socketManager.broadcastState(gameEngine.getState());
        const state = gameEngine.selectQuestion(question);
        socketManager.broadcast('game:question-selected', state);
        socketManager.broadcastState(state);
        return res.json({ success: true, data: state });
      }

      return res.status(400).json({ success: false, error: 'step invalide' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
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

  // POST /api/game/reset-workflow - Recommencer la sélection guidée (étape 1)
  router.post('/reset-workflow', (req, res) => {
    try {
      const state = gameEngine.getState();
      gameEngine.clearSelectionState();
      const newState = gameEngine.getState();
      const steps = buildStepsPayload(dataStore, {}, {});
      const selectionState = { currentStep: 'matiere', steps };
      gameEngine.setSelectionState(selectionState);
      const finalState = gameEngine.getState();
      socketManager.broadcast('game:selection-step', finalState);
      socketManager.broadcastState(finalState);
      res.json({ success: true, data: finalState });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = createGameRoutes;
