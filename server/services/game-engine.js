/**
 * Game Engine - Machine à états du jeu
 * Gère les états, transitions, scores et historique des questions.
 */

const STATES = {
  WAITING: 'waiting',
  QUESTION_DISPLAYED: 'question_displayed',
  ANSWER_REVEALED: 'answer_revealed',
  ANSWER_VALIDATED: 'answer_validated',
  SCOREBOARD: 'scoreboard',
};

const SCREENS = {
  WAITING: 'waiting',
  QUESTION: 'question',
  ANSWER: 'answer',
  SCORES: 'scores',
};

class GameEngine {
  constructor() {
    this.reset();
  }

  /**
   * Réinitialise l'état complet du jeu
   */
  reset() {
    this.state = STATES.WAITING;
    this.screen = SCREENS.WAITING;
    this.currentQuestion = null;
    this.selectedAnswer = null;
    this.isCorrect = null;
    this.scores = {};
    this.questionHistory = [];
    this.questionCount = 0;
  }

  /**
   * Retourne l'état complet sérialisable du jeu
   */
  getState() {
    return {
      state: this.state,
      screen: this.screen,
      currentQuestion: this.currentQuestion,
      selectedAnswer: this.selectedAnswer,
      isCorrect: this.isCorrect,
      scores: { ...this.scores },
      questionHistory: [...this.questionHistory],
      questionCount: this.questionCount,
    };
  }

  /**
   * Sélectionne une question à afficher
   */
  selectQuestion(question) {
    if (!question) {
      throw new Error('Question invalide');
    }

    this.state = STATES.QUESTION_DISPLAYED;
    this.screen = SCREENS.QUESTION;
    this.currentQuestion = {
      id: question.ID,
      question: question.Question,
      rightAnswer: question.Right_Answer,
      propositions: this._shufflePropositions(question),
      explications: question.Explications,
      typeQuestion: question.Type_Question,
      themeName: question.themeName || '',
      levelName: question.levelName || '',
      categoryName: question.categoryName || '',
    };
    this.selectedAnswer = null;
    this.isCorrect = null;
    this.questionCount++;

    if (!this.questionHistory.includes(question.ID)) {
      this.questionHistory.push(question.ID);
    }

    return this.getState();
  }

  /**
   * Mélange les propositions (bonne réponse + 3 propositions)
   */
  _shufflePropositions(question) {
    const propositions = [
      question.Right_Answer,
      question.Proposition1,
      question.Proposition2,
      question.Proposition3,
    ].filter(p => p && p.trim() !== '');

    // Fisher-Yates shuffle
    for (let i = propositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [propositions[i], propositions[j]] = [propositions[j], propositions[i]];
    }

    return propositions;
  }

  /**
   * Révèle la bonne réponse sans valider
   */
  revealAnswer() {
    if (this.state !== STATES.QUESTION_DISPLAYED) {
      throw new Error(`Action impossible dans l'état: ${this.state}. État attendu: question_displayed`);
    }

    this.state = STATES.ANSWER_REVEALED;
    this.screen = SCREENS.ANSWER;
    return this.getState();
  }

  /**
   * Valide une réponse sélectionnée
   */
  validateAnswer(propositionIndex) {
    if (this.state !== STATES.QUESTION_DISPLAYED && this.state !== STATES.ANSWER_REVEALED) {
      throw new Error(`Action impossible dans l'état: ${this.state}`);
    }

    if (!this.currentQuestion) {
      throw new Error('Aucune question en cours');
    }

    const selected = this.currentQuestion.propositions[propositionIndex];
    if (selected === undefined) {
      throw new Error(`Index de proposition invalide: ${propositionIndex}`);
    }

    this.selectedAnswer = propositionIndex;
    this.isCorrect = selected === this.currentQuestion.rightAnswer;
    this.state = STATES.ANSWER_VALIDATED;
    this.screen = SCREENS.ANSWER;

    return this.getState();
  }

  /**
   * Passe à l'étape suivante
   */
  next() {
    if (this.state === STATES.ANSWER_VALIDATED || this.state === STATES.SCOREBOARD) {
      this.state = STATES.WAITING;
      this.screen = SCREENS.WAITING;
      this.currentQuestion = null;
      this.selectedAnswer = null;
      this.isCorrect = null;
      return this.getState();
    }

    throw new Error(`Action 'next' impossible dans l'état: ${this.state}`);
  }

  /**
   * Affiche le tableau des scores
   */
  showScores() {
    this.state = STATES.SCOREBOARD;
    this.screen = SCREENS.SCORES;
    return this.getState();
  }

  /**
   * Change l'écran affiché directement
   */
  setScreen(screen) {
    const validScreens = Object.values(SCREENS);
    if (!validScreens.includes(screen)) {
      throw new Error(`Écran invalide: ${screen}. Valeurs possibles: ${validScreens.join(', ')}`);
    }
    this.screen = screen;
    return this.getState();
  }

  /**
   * Met à jour le score d'un joueur
   */
  updateScore(playerName, delta) {
    if (!playerName || typeof playerName !== 'string') {
      throw new Error('Nom du joueur invalide');
    }
    if (typeof delta !== 'number') {
      throw new Error('Delta de score invalide');
    }

    if (!this.scores[playerName]) {
      this.scores[playerName] = 0;
    }
    this.scores[playerName] += delta;
    return this.getState();
  }

  /**
   * Vérifie si une question a déjà été posée
   */
  wasQuestionAsked(questionId) {
    return this.questionHistory.includes(questionId);
  }
}

module.exports = { GameEngine, STATES, SCREENS };
