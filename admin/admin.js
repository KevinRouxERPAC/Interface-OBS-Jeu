/**
 * ADMIN SCRIPT
 * Interface de contrôle du quiz pour le streamer
 * Envoie les commandes à l'overlay et gère le flux complet
 */

(() => {
  // ========================
  // CONFIG & CONSTANTS
  // ========================
  const CONFIG = {
    channelName: 'quiz-control',
    apiUrl: 'http://localhost:3000',
    // En développement, pas de clé API nécessaire
    apiKey: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
      ? '' 
      : (localStorage.getItem('quiz-api-key') || ''),
    selectionDisplayDelay: 3000, // ms - délai d'affichage des sélections
    errorRetryDelay: 2000, // ms - délai avant retry en cas d'erreur réseau
    maxRetries: 3, // nombre max de tentatives de reconnexion
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  };

  // ========================
  // DOM ELEMENTS
  // ========================
  const DOM = {
    // Status
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    
    // Sections
    waitingSection: document.getElementById('section-waiting'),
    levelSelectionSection: document.getElementById('section-level-selection'),
    categorySelectionSection: document.getElementById('section-category-selection'),
    themeSelectionSection: document.getElementById('section-theme-selection'),
    questionWaitingSection: document.getElementById('section-question-waiting'),
    questionActiveSection: document.getElementById('section-question-active'),
    
    // Boutons contrôles
    btnStartSelection: document.getElementById('btn-start-selection'),
    btnDrawTheme: document.getElementById('btn-draw-theme'),
    btnLaunchQuestion: document.getElementById('btn-launch-question'),
    btnRevealAnswer: document.getElementById('btn-reveal-answer'),
    btnNewQuestion: document.getElementById('btn-new-question'),
    btnRestartSelection: document.getElementById('btn-restart-selection'),
    btnShutdownServer: document.getElementById('btn-shutdown-server'),
    
    // Grilles
    levelsGrid: document.getElementById('levels-grid'),
    categoriesGrid: document.getElementById('categories-grid'),
    
    // Affichages
    displayLevel: document.getElementById('display-level'),
    displayLevel2: document.getElementById('display-level-2'),
    displayLevel3: document.getElementById('display-level-3'),
    displayCategory: document.getElementById('display-category'),
    displayCategory2: document.getElementById('display-category-2'),
    displayTheme: document.getElementById('display-theme'),
    displayCorrectAnswer: document.getElementById('display-correct-answer'),
    
    // Informations
    currentState: document.getElementById('current-state'),
    currentQuestion: document.getElementById('current-question'),
    eventLog: document.getElementById('event-log')
  };

  // ========================
  // STATE
  // ========================
  let state = {
    screen: 'WAITING', // WAITING, LEVEL_SELECTION, CATEGORY_SELECTION, THEME_SELECTION, QUESTION_WAITING, QUESTION_ACTIVE
    selectedLevel: null,
    selectedCategory: null,
    selectedTheme: null,
    currentQuestion: null,
    allLevels: [],
    allCategories: [],
    allThemes: []
  };

  // ========================
  // COMMUNICATION
  // ========================
  let channel = null;
  let lastCommandId = 0;

  /**
   * Initialise la communication avec l'overlay
   */
  function initChannel() {
    if (CONFIG.isDevelopment) {
      console.log('[ADMIN] Initialisation de la communication');
    }
    
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(CONFIG.channelName);
        if (CONFIG.isDevelopment) {
          console.log('[ADMIN] BroadcastChannel activé');
        }
      } catch (err) {
        if (CONFIG.isDevelopment) {
          console.warn('[ADMIN] BroadcastChannel échoué:', err);
        }
      }
    }
  }

  /**
   * Envoie une commande à l'overlay
   */
  let retryCount = 0;
  async function sendCommand(cmd) {
    if (CONFIG.isDevelopment) {
      console.log('[ADMIN] Envoi commande:', cmd);
    }
    
    // Via BroadcastChannel (onglets navigateur)
    if (channel) {
      channel.postMessage(cmd);
    }
    
    // Via API serveur (OBS) avec retry logic
    // En développement, on envoie toujours même sans clé API
    if (CONFIG.apiUrl) {
      try {
        const res = await fetchWithApiKey(`${CONFIG.apiUrl}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd)
        });
        
        if (!res.ok) {
          if (res.status === 401) {
            const errorData = await res.json().catch(() => ({ error: 'Non autorisé' }));
            if (CONFIG.isDevelopment) {
              console.warn('[ADMIN] Erreur 401 - Clé API manquante ou invalide:', errorData.error);
              console.warn('[ADMIN] 💡 En développement, la clé API est optionnelle. Le serveur devrait accepter.');
              // En développement, on continue quand même (le serveur devrait accepter)
              return; // Ne pas throw, juste logger
            } else {
              throw new Error(`HTTP ${res.status}: ${errorData.error}`);
            }
          } else if (res.status === 403) {
            throw new Error(`HTTP ${res.status}: Accès interdit`);
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        }
        
        retryCount = 0; // Reset on success
      } catch (err) {
        retryCount++;
        if (CONFIG.isDevelopment) {
          console.warn('[ADMIN] Erreur envoi serveur:', err);
        }
        
        // Retry automatique avec backoff exponentiel (sauf pour les erreurs 401/403)
        if (retryCount <= CONFIG.maxRetries && !err.message?.includes('401') && !err.message?.includes('403')) {
          const delay = CONFIG.errorRetryDelay * Math.pow(2, retryCount - 1);
          setTimeout(() => sendCommand(cmd), delay);
        }
      }
    }
  }

  /**
   * Fetch avec support clé API
   */
  function fetchWithApiKey(url, options = {}) {
    const headers = { ...options.headers };
    if (CONFIG.apiKey) {
      headers['X-API-Key'] = CONFIG.apiKey;
    }
    return fetch(url, { ...options, headers });
  }

  // ========================
  // LOGGER
  // ========================

  /**
   * Log un événement dans le journal et la console
   */
  function logEvent(msg) {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const entry = `[${timestamp}] ${msg}`;
    
    if (CONFIG.isDevelopment) {
      console.log('[ADMIN]', msg);
    }
    
    // Ajoute au journal visuel
    const log = DOM.eventLog;
    if (log && log.textContent.includes('En attente d\'événements')) {
      log.innerHTML = '';
    }
    
    if (log) {
      const line = document.createElement('div');
      line.textContent = entry;
      line.style.marginBottom = '4px';
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }
  }

  // ========================
  // UI MANAGEMENT
  // ========================

  /**
   * Affiche la section appropriée basée sur l'état
   */
  function updateUI() {
    // Masque toutes les sections
    DOM.waitingSection.style.display = 'none';
    DOM.levelSelectionSection.style.display = 'none';
    DOM.categorySelectionSection.style.display = 'none';
    DOM.themeSelectionSection.style.display = 'none';
    DOM.questionWaitingSection.style.display = 'none';
    DOM.questionActiveSection.style.display = 'none';
    
    // Affiche la bonne section
    switch (state.screen) {
      case 'WAITING':
        DOM.waitingSection.style.display = 'block';
        DOM.statusText.textContent = 'État: EN ATTENTE';
        updateCurrentState('EN ATTENTE', '-', '-', '-');
        break;
        
      case 'LEVEL_SELECTION':
        DOM.levelSelectionSection.style.display = 'block';
        DOM.statusText.textContent = 'État: SÉLECTION DIFFICULTÉ';
        updateCurrentState('SÉLECTION DIFFICULTÉ', '-', '-', '-');
        break;
        
      case 'CATEGORY_SELECTION':
        DOM.categorySelectionSection.style.display = 'block';
        DOM.displayLevel.textContent = state.selectedLevel?.name || '-';
        DOM.statusText.textContent = 'État: SÉLECTION CATÉGORIE';
        updateCurrentState('SÉLECTION CATÉGORIE', state.selectedLevel?.name, '-', '-');
        break;
        
      case 'THEME_SELECTION':
        DOM.themeSelectionSection.style.display = 'block';
        DOM.displayLevel2.textContent = state.selectedLevel?.name || '-';
        DOM.displayCategory.textContent = state.selectedCategory?.name || '-';
        DOM.statusText.textContent = 'État: SÉLECTION THÈME';
        updateCurrentState('SÉLECTION THÈME', state.selectedLevel?.name, state.selectedCategory?.name, '-');
        break;
        
      case 'QUESTION_WAITING':
        DOM.questionWaitingSection.style.display = 'block';
        DOM.displayLevel3.textContent = state.selectedLevel?.name || '-';
        DOM.displayCategory2.textContent = state.selectedCategory?.name || '-';
        DOM.displayTheme.textContent = state.selectedTheme?.name || '-';
        DOM.statusText.textContent = 'État: ATTENTE QUESTION';
        updateCurrentState('ATTENTE QUESTION', state.selectedLevel?.name, state.selectedCategory?.name, state.selectedTheme?.name);
        break;
        
      case 'QUESTION_ACTIVE':
        DOM.questionActiveSection.style.display = 'block';
        const correctIdx = state.currentQuestion?.bonneReponse;
        const keyLabelsUI = ['A', 'B', 'C', 'D'];
        const correctAnswer = keyLabelsUI[correctIdx] || '?';
        DOM.displayCorrectAnswer.textContent = `${correctAnswer}`;
        DOM.statusText.textContent = 'État: QUESTION EN COURS';
        updateCurrentQuestion(state.currentQuestion);
        // Affiche les boutons de sélection de réponse
        const answerBtns = document.getElementById('answer-selection-buttons');
        if (answerBtns) {
          answerBtns.style.display = 'grid';
        }
        break;
    }
  }

  /**
   * Met à jour l'affichage de l'état actuel
   */
  function updateCurrentState(status, level, category, theme) {
    DOM.currentState.innerHTML = `
      <strong>Statut:</strong> ${status}<br>
      <strong>Niveau:</strong> ${level}<br>
      <strong>Catégorie:</strong> ${category}<br>
      <strong>Thème:</strong> ${theme}
    `;
  }

  /**
   * Met à jour l'affichage de la question actuelle
   */
  function updateCurrentQuestion(question) {
    if (!question) {
      DOM.currentQuestion.innerHTML = '<em>Aucune question chargée</em>';
      return;
    }
    
    const keyLabels = ['A', 'B', 'C', 'D'];
    const correctIdx = question.bonneReponse;
    const correctAnswer = keyLabels[correctIdx] || '?';
    
    DOM.currentQuestion.innerHTML = `
      <strong>Q:</strong> ${question.question}<br>
      <strong>Réponses:</strong><br>
      ${question.propositions.map((p, i) => {
        const mark = i === correctIdx ? '✓ ' : '';
        return `&nbsp;&nbsp;${keyLabels[i]}) ${mark}${p}`;
      }).join('<br>')}<br>
      <strong>Explication:</strong> ${question.explication || '-'}<br>
      <strong>Thème:</strong> ${question.theme || '-'}
    `;
  }

  // ========================
  // LOAD DATA
  // ========================

  /**
   * Charge les difficultés depuis le serveur
   */
  async function loadLevels() {
    try {
      const res = await fetchWithApiKey(`${CONFIG.apiUrl}/levels`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const levels = await res.json();
      if (!Array.isArray(levels)) {
        throw new Error('Format de données invalide');
      }
      state.allLevels = levels;
      renderLevelButtons();
      logEvent('✓ Difficultés chargées: ' + levels.length);
    } catch (err) {
      if (CONFIG.isDevelopment) {
        console.error('[ADMIN] Erreur chargement niveaux:', err);
      }
      logEvent('✗ Erreur chargement difficultés: ' + err.message);
    }
  }

  /**
   * Charge les catégories depuis le serveur
   */
  async function loadCategories() {
    try {
      const res = await fetchWithApiKey(`${CONFIG.apiUrl}/categories`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const categories = await res.json();
      if (!Array.isArray(categories)) {
        throw new Error('Format de données invalide');
      }
      state.allCategories = categories;
      renderCategoryButtons();
      logEvent('✓ Catégories chargées: ' + categories.length);
    } catch (err) {
      if (CONFIG.isDevelopment) {
        console.error('[ADMIN] Erreur chargement catégories:', err);
      }
      logEvent('✗ Erreur chargement catégories: ' + err.message);
    }
  }

  /**
   * Charge les thèmes pour une catégorie
   */
  async function loadThemesForCategory(categoryId) {
    try {
      const url = `${CONFIG.apiUrl}/themes?categoryId=${categoryId}`;
      const res = await fetchWithApiKey(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const themes = await res.json();
      if (!Array.isArray(themes)) {
        throw new Error('Format de données invalide');
      }
      state.allThemes = themes;
      logEvent('✓ Thèmes chargés: ' + themes.length);
      return themes;
    } catch (err) {
      if (CONFIG.isDevelopment) {
        console.error('[ADMIN] Erreur chargement thèmes:', err);
      }
      logEvent('✗ Erreur chargement thèmes: ' + err.message);
      return [];
    }
  }

  /**
   * Charge une question aléatoire
   */
  async function loadRandomQuestion() {
    try {
      const params = new URLSearchParams();
      if (state.selectedLevel?.id) params.append('levelId', state.selectedLevel.id);
      if (state.selectedCategory?.id) params.append('categoryId', state.selectedCategory.id);
      if (state.selectedTheme?.id) params.append('themeId', state.selectedTheme.id);
      
      const url = `${CONFIG.apiUrl}/random?${params.toString()}`;
      const res = await fetchWithApiKey(url);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Aucune question trouvée avec ces critères');
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const question = await res.json();
      if (!question || !question.question) {
        throw new Error('Format de question invalide');
      }
      state.currentQuestion = question;
      logEvent(`✓ Question chargée: "${question.question.substring(0, 40)}..."`);
      return question;
    } catch (err) {
      if (CONFIG.isDevelopment) {
        console.error('[ADMIN] Erreur chargement question:', err);
      }
      logEvent('✗ Erreur chargement question: ' + err.message);
      return null;
    }
  }

  // ========================
  // RENDER BUTTONS
  // ========================

  /**
   * Crée les boutons de difficulté
   */
  function renderLevelButtons() {
    DOM.levelsGrid.innerHTML = '';
    state.allLevels.forEach(level => {
      const btn = document.createElement('button');
      btn.textContent = level.name;
      btn.addEventListener('click', () => selectLevel(level));
      DOM.levelsGrid.appendChild(btn);
    });
  }

  /**
   * Crée les boutons de catégorie
   */
  function renderCategoryButtons() {
    DOM.categoriesGrid.innerHTML = '';
    state.allCategories.forEach(category => {
      const btn = document.createElement('button');
      btn.textContent = category.name;
      btn.addEventListener('click', () => selectCategory(category));
      DOM.categoriesGrid.appendChild(btn);
    });
  }

  // ========================
  // FLOW HANDLERS
  // ========================

  /**
   * Démarre une nouvelle sélection
   */
  async function startSelection() {
    logEvent('🎬 Nouvelle sélection lancée');
    state.screen = 'LEVEL_SELECTION';
    state.selectedLevel = null;
    state.selectedCategory = null;
    state.selectedTheme = null;
    state.currentQuestion = null;
    
    updateUI();
    
    // Charge les niveaux
    await loadLevels();
    
    // Envoie la commande à l'overlay + affiche immédiatement les difficultés
    sendCommand({ type: 'START_SELECTION' });
    sendCommand({
      type: 'SHOW_LEVELS_LIST',
      levels: state.allLevels,
      selectedId: null
    });
  }

  /**
   * Sélectionne une difficulté
   */
  async function selectLevel(level) {
    logEvent(`🎯 Difficulté sélectionnée: ${level.name}`);
    state.selectedLevel = level;
    state.selectedCategory = null;
    state.selectedTheme = null;
    state.screen = 'CATEGORY_SELECTION';
    
    // Charge les catégories
    await loadCategories();
    
    // Envoie la sélection à l'overlay
    sendCommand({
      type: 'SHOW_LEVELS_LIST',
      levels: state.allLevels,
      selectedId: level.id
    });
    
    // Attend avant d'afficher les catégories côté overlay
    setTimeout(() => {
      updateUI();
      sendCommand({
        type: 'SHOW_CATEGORIES_LIST',
        categories: state.allCategories
      });
    }, CONFIG.selectionDisplayDelay);
  }

  /**
   * Sélectionne une catégorie
   */
  async function selectCategory(category) {
    logEvent(`📂 Catégorie sélectionnée: ${category.name}`);
    state.selectedCategory = category;
    state.selectedTheme = null;
    state.screen = 'THEME_SELECTION';
    
    // Charge les thèmes pour cette catégorie
    const themes = await loadThemesForCategory(category.id);
    
    // Envoie la sélection à l'overlay
    sendCommand({
      type: 'SHOW_CATEGORIES_LIST',
      categories: state.allCategories,
      selectedId: category.id
    });
    
    // Attend avant d'afficher le bouton de tirage thème côté admin
    setTimeout(() => {
      updateUI();
    }, CONFIG.selectionDisplayDelay);
  }

  /**
   * Tire un thème aléatoire
   */
  function drawTheme() {
    if (!state.allThemes || state.allThemes.length === 0) {
      logEvent('✗ Aucun thème disponible');
      alert('Aucun thème disponible pour cette catégorie');
      return;
    }
    
    const randomTheme = state.allThemes[Math.floor(Math.random() * state.allThemes.length)];
    logEvent(`🎨 Thème tiré: ${randomTheme.name}`);
    state.selectedTheme = randomTheme;
    state.screen = 'QUESTION_WAITING';
    
    // Envoie le thème à l'overlay
    sendCommand({
      type: 'SHOW_THEME',
      theme: randomTheme,
      level: state.selectedLevel,
      category: state.selectedCategory
    });
    
    updateUI();
  }

  /**
   * Lance une question
   */
  async function launchQuestion() {
    logEvent('🚀 Lancement d\'une question...');
    
    const question = await loadRandomQuestion();
    if (!question) {
      alert('Erreur lors du chargement de la question');
      return;
    }
    
    state.screen = 'QUESTION_ACTIVE';
    
    // Envoie la question à l'overlay
    sendCommand({
      type: 'LOAD_QUESTION',
      question: question,
      level: state.selectedLevel,
      category: state.selectedCategory,
      theme: state.selectedTheme
    });
    
    updateUI();
  }

  /**
   * Sélectionne une réponse (depuis les boutons A/B/C/D)
   */
  function selectAnswerButton(index) {
    if (!state.currentQuestion) {
      alert('Aucune question active');
      return;
    }
    
    const keyLabels = ['A', 'B', 'C', 'D'];
    logEvent(`🔘 Réponse sélectionnée: ${keyLabels[index]}`);
    state.currentQuestion.selectedByAdmin = index;
    updateCurrentQuestion(state.currentQuestion);
    
    // Envoie la sélection à l'overlay
    sendCommand({
      type: 'HIGHLIGHT_ANSWER',
      index: index
    });
  }

  /**
   * Révèle la réponse
   */
  function revealAnswer() {
    if (!state.currentQuestion) {
      alert('Aucune question active');
      return;
    }
    
    logEvent('✅ Réponse révélée');
    sendCommand({ type: 'REVEAL_ANSWER' });
  }

  /**
   * Lance une nouvelle question du même thème
   */
  async function newQuestion() {
    logEvent('📋 Nouvelle question du même thème');
    await launchQuestion();
  }

  /**
   * Redémarre une nouvelle sélection
   */
  async function restartSelection() {
    logEvent('🎬 Redémarrage avec nouvelle sélection');
    await startSelection();
  }

  /**
   * Arrête le serveur
   */
  async function shutdownServer() {
    if (!confirm('Êtes-vous sûr de vouloir arrêter le serveur ?\n\nL\'overlay et l\'admin ne fonctionneront plus après l\'arrêt.')) {
      return;
    }
    
    try {
      logEvent('Arrêt du serveur demandé...');
      DOM.btnShutdownServer.disabled = true;
      DOM.btnShutdownServer.textContent = '⏳ Arrêt en cours...';
      
      const res = await fetchWithApiKey(`${CONFIG.apiUrl}/shutdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        logEvent('✓ Serveur arrêté avec succès');
        alert('Le serveur a été arrêté avec succès.\n\nVous pouvez le redémarrer depuis l\'application de gestion.');
        
        // Désactiver tous les boutons
        DOM.btnStartSelection.disabled = true;
        DOM.btnDrawTheme.disabled = true;
        DOM.btnLaunchQuestion.disabled = true;
        DOM.btnRevealAnswer.disabled = true;
        DOM.btnNewQuestion.disabled = true;
        DOM.btnRestartSelection.disabled = true;
        
        // Mettre à jour le statut
        if (DOM.statusDot) {
          DOM.statusDot.classList.remove('connected', 'waiting');
        }
        if (DOM.statusText) {
          DOM.statusText.textContent = 'État: SERVEUR ARRÊTÉ';
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      logEvent(`✗ Erreur lors de l'arrêt: ${err.message}`);
      alert(`Erreur lors de l'arrêt du serveur:\n${err.message}`);
      DOM.btnShutdownServer.disabled = false;
      DOM.btnShutdownServer.textContent = '🛑 Arrêter le Serveur';
    }
  }

  // ========================
  // EVENT LISTENERS
  // ========================

  function setupEventListeners() {
    DOM.btnStartSelection.addEventListener('click', startSelection);
    DOM.btnDrawTheme.addEventListener('click', drawTheme);
    DOM.btnLaunchQuestion.addEventListener('click', launchQuestion);
    DOM.btnRevealAnswer.addEventListener('click', revealAnswer);
    DOM.btnNewQuestion.addEventListener('click', newQuestion);
    DOM.btnRestartSelection.addEventListener('click', restartSelection);
    DOM.btnShutdownServer.addEventListener('click', shutdownServer);
    
    // Ajoute les boutons A/B/C/D en section active pour sélectionner la réponse
    const keyLabels = ['A', 'B', 'C', 'D'];
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'answer-selection-buttons';
    buttonContainer.style.display = 'none';
    buttonContainer.style.marginTop = '12px';
    buttonContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.display = 'grid';
    
    keyLabels.forEach((label, idx) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.padding = '10px';
      btn.style.minWidth = '40px';
      btn.addEventListener('click', () => selectAnswerButton(idx));
      buttonContainer.appendChild(btn);
    });
    
    DOM.questionActiveSection.appendChild(buttonContainer);
  }

  // ========================
  // INITIALIZATION
  // ========================

  function init() {
    if (CONFIG.isDevelopment) {
      console.log('[ADMIN] Démarrage de l\'admin');
    }
    initChannel();
    setupEventListeners();
    updateUI();
    logEvent('✓ Admin prêt');
  }

  // Lance l'initialisation
  init();
})();
