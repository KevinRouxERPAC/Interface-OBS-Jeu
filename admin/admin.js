/**
 * ADMIN SCRIPT
 * Interface de contrôle du quiz pour le streamer
 * Envoie les commandes à l'overlay et gère le flux complet
 */

(() => {
  // ========================
  // CONFIG & CONSTANTS
  // ========================
  // Permettre de forcer l'URL de l'API (ex. déploiement Fly.io : ?apiBase=https://ton-app.fly.dev)
  const urlParams = new URLSearchParams(window.location.search);
  const apiBaseFromUrl = urlParams.get('apiBase') || urlParams.get('api');
  const origin = window.location.origin;
  const defaultApiUrl = origin + '/api';
  const apiUrl = apiBaseFromUrl
    ? (apiBaseFromUrl.replace(/\/$/, '') + '/api')
    : defaultApiUrl;

  const CONFIG = {
    channelName: 'quiz-control',
    apiUrl,
    selectionDisplayDelay: 3000, // ms - délai d'affichage des sélections
    errorRetryDelay: 2000, // ms - délai avant retry en cas d'erreur réseau
    maxRetries: 3, // nombre max de tentatives de reconnexion
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  };

  const STORAGE_KEYS = {
    matiereScope: 'quiz-matiere-scope'
  };

  const MATIERE_SCOPE = {
    ALL: 'ALL',
    HISTOIRE_ONLY: 'HISTOIRE_ONLY'
  };

  const HISTOIRE_MATIERE_NAME = 'Histoire';

  // ========================
  // DOM ELEMENTS
  // ========================
  const DOM = {
    // Status
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    
    // Sections
    waitingSection: document.getElementById('section-waiting'),
    matiereSelectionSection: document.getElementById('section-matiere-selection'),
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
    btnRestartSelectionAlways: document.getElementById('btn-restart-selection-always'),

    // Options
    matiereScopeSelect: document.getElementById('matiere-scope'),
    // Grilles
    matieresGrid: document.getElementById('matieres-grid'),
    levelsGrid: document.getElementById('levels-grid'),
    categoriesGrid: document.getElementById('categories-grid'),
    
    // Affichages
    displayMatiere: document.getElementById('display-matiere'),
    displayMatiere2: document.getElementById('display-matiere-2'),
    displayMatiere3: document.getElementById('display-matiere-3'),
    displayMatiere4: document.getElementById('display-matiere-4'),
    displayLevel: document.getElementById('display-level'),
    displayLevel2: document.getElementById('display-level-2'),
    displayLevel3: document.getElementById('display-level-3'),
    displayCategory: document.getElementById('display-category'),
    displayCategory2: document.getElementById('display-category-2'),
    displayTheme: document.getElementById('display-theme'),
    displayCorrectAnswer: document.getElementById('display-correct-answer'),
    
    // Informations (blocs streamer)
    currentState: document.getElementById('current-state'),
    adminInfoTags: document.getElementById('admin-info-tags'),
    adminThemeDesc: document.getElementById('admin-theme-desc'),
    currentQuestion: document.getElementById('current-question'),
    adminPropositions: document.getElementById('admin-propositions'),
    adminBlockPropositions: document.getElementById('admin-block-propositions'),
    adminExplication: document.getElementById('admin-explication'),
    adminBlockExplication: document.getElementById('admin-block-explication'),
    eventLog: document.getElementById('event-log')
  };

  function normalizeText(s) {
    return String(s ?? '').trim().toLowerCase();
  }

  function getMatiereScope() {
    const raw = (DOM.matiereScopeSelect?.value || localStorage.getItem(STORAGE_KEYS.matiereScope) || MATIERE_SCOPE.ALL);
    return raw === MATIERE_SCOPE.HISTOIRE_ONLY ? MATIERE_SCOPE.HISTOIRE_ONLY : MATIERE_SCOPE.ALL;
  }

  function setMatiereScope(scope) {
    const normalized = scope === MATIERE_SCOPE.HISTOIRE_ONLY ? MATIERE_SCOPE.HISTOIRE_ONLY : MATIERE_SCOPE.ALL;
    localStorage.setItem(STORAGE_KEYS.matiereScope, normalized);
    if (DOM.matiereScopeSelect) {
      DOM.matiereScopeSelect.value = normalized;
    }
  }

  function initMatiereScopeSelect() {
    if (!DOM.matiereScopeSelect) return;
    const stored = localStorage.getItem(STORAGE_KEYS.matiereScope);
    setMatiereScope(stored);
    DOM.matiereScopeSelect.addEventListener('change', () => {
      setMatiereScope(DOM.matiereScopeSelect.value);
      const label = getMatiereScope() === MATIERE_SCOPE.HISTOIRE_ONLY ? 'Uniquement Histoire' : 'Toutes les matières';
      logEvent(`⚙️ Option matières: ${label}`);
    });
  }

  function findHistoireMatiere(matieres) {
    if (!Array.isArray(matieres)) return null;
    const byName = matieres.find(m => normalizeText(m?.name) === normalizeText(HISTOIRE_MATIERE_NAME));
    if (byName) return byName;
    const byId = matieres.find(m => String(m?.id) === '1');
    return byId || null;
  }

  // ========================
  // STATE
  // ========================
  let state = {
    screen: 'WAITING', // WAITING, MATIERE_SELECTION, LEVEL_SELECTION, CATEGORY_SELECTION, THEME_SELECTION, QUESTION_WAITING, QUESTION_ACTIVE
    selectedMatiere: null,
    selectedLevel: null,
    selectedCategory: null,
    selectedTheme: null,
    currentQuestion: null,
    answerRevealed: false,
    allMatieres: [],
    allLevels: [],
    allCategories: [],
    allThemes: [],
    // Enchaînement sans répétition : pool de questions du thème (mélangé), index courant
    themeQuestionPool: [],
    themeQuestionIndex: 0,
    themeQuestionPoolThemeId: null
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
    // Masque toutes les sections et retire les classes d'animation
    const allSections = [
      DOM.waitingSection,
      DOM.matiereSelectionSection,
      DOM.levelSelectionSection,
      DOM.categorySelectionSection,
      DOM.themeSelectionSection,
      DOM.questionWaitingSection,
      DOM.questionActiveSection
    ];
    
    allSections.forEach(section => {
      if (section) {
        section.style.display = 'none';
        section.classList.remove('screen-transition', 'fade-in');
      }
    });
    
    // Affiche la bonne section avec animation
    let activeSection = null;
    switch (state.screen) {
      case 'WAITING':
        activeSection = DOM.waitingSection;
        DOM.statusText.textContent = 'État: EN ATTENTE';
        updateCurrentState('EN ATTENTE', '-', '-', '-', '-', '');
        updateCurrentQuestion(null);
        break;
        
      case 'MATIERE_SELECTION':
        activeSection = DOM.matiereSelectionSection;
        DOM.statusText.textContent = 'État: SÉLECTION MATIÈRE';
        updateCurrentState('SÉLECTION MATIÈRE', '-', '-', '-', '-', '');
        updateCurrentQuestion(null);
        break;
        
      case 'LEVEL_SELECTION':
        activeSection = DOM.levelSelectionSection;
        DOM.displayMatiere.textContent = state.selectedMatiere?.name || '-';
        DOM.statusText.textContent = 'État: SÉLECTION DIFFICULTÉ';
        updateCurrentState('SÉLECTION DIFFICULTÉ', state.selectedMatiere?.name, '-', '-', '-', '');
        updateCurrentQuestion(null);
        break;
        
      case 'CATEGORY_SELECTION':
        activeSection = DOM.categorySelectionSection;
        DOM.displayMatiere2.textContent = state.selectedMatiere?.name || '-';
        DOM.displayLevel.textContent = state.selectedLevel?.name || '-';
        DOM.statusText.textContent = 'État: SÉLECTION CATÉGORIE';
        updateCurrentState('SÉLECTION CATÉGORIE', state.selectedMatiere?.name, state.selectedLevel?.name, '-', '-', '');
        updateCurrentQuestion(null);
        break;
        
      case 'THEME_SELECTION':
        activeSection = DOM.themeSelectionSection;
        DOM.displayMatiere3.textContent = state.selectedMatiere?.name || '-';
        DOM.displayLevel2.textContent = state.selectedLevel?.name || '-';
        DOM.displayCategory.textContent = state.selectedCategory?.name || '-';
        DOM.statusText.textContent = 'État: SÉLECTION THÈME';
        updateCurrentState('SÉLECTION THÈME', state.selectedMatiere?.name, state.selectedLevel?.name, state.selectedCategory?.name, '-', '');
        updateCurrentQuestion(null);
        break;
        
      case 'QUESTION_WAITING':
        activeSection = DOM.questionWaitingSection;
        DOM.displayMatiere4.textContent = state.selectedMatiere?.name || '-';
        DOM.displayLevel3.textContent = state.selectedLevel?.name || '-';
        DOM.displayCategory2.textContent = state.selectedCategory?.name || '-';
        DOM.displayTheme.textContent = state.selectedTheme?.name || '-';
        DOM.statusText.textContent = 'État: ATTENTE QUESTION';
        updateCurrentState('ATTENTE QUESTION', state.selectedMatiere?.name, state.selectedLevel?.name, state.selectedCategory?.name, state.selectedTheme?.name, state.selectedTheme?.description || '');
        updateCurrentQuestion(null);
        break;
        
      case 'QUESTION_ACTIVE':
        activeSection = DOM.questionActiveSection;
        const correctIdx = state.currentQuestion?.bonneReponse;
        const keyLabelsUI = ['A', 'B', 'C', 'D'];
        const correctAnswer = keyLabelsUI[correctIdx] || '?';
        DOM.displayCorrectAnswer.textContent = `${correctAnswer}`;
        DOM.statusText.textContent = 'État: QUESTION EN COURS';
        updateCurrentState('QUESTION EN COURS', state.selectedMatiere?.name, state.selectedLevel?.name, state.selectedCategory?.name, state.selectedTheme?.name, state.selectedTheme?.description || '');
        updateCurrentQuestion(state.currentQuestion);
        const answerBtns = document.getElementById('answer-selection-buttons');
        if (answerBtns) {
          answerBtns.style.display = 'grid';
        }
        break;
    }
    
    // Affiche la section active avec animation
    if (activeSection) {
      activeSection.style.display = 'block';
      activeSection.classList.add('screen-transition');
      // Force le reflow pour déclencher l'animation
      void activeSection.offsetWidth;
    }
  }

  /**
   * Met à jour le bloc Infos générales (tags + description du thème)
   */
  function updateCurrentState(status, matiere, level, category, theme, themeDescription) {
    const tags = DOM.adminInfoTags;
    const desc = DOM.adminThemeDesc;
    if (!tags || !desc) return;
    
    const items = [
      { label: 'Statut', value: status },
      { label: 'Matière', value: matiere },
      { label: 'Difficulté', value: level },
      { label: 'Catégorie', value: category },
      { label: 'Thème', value: theme }
    ];
    tags.innerHTML = items.map(({ label, value }) =>
      `<span class="admin-tag">${label}: <strong>${value || '-'}</strong></span>`
    ).join('');
    
    if (themeDescription && String(themeDescription).trim()) {
      desc.textContent = themeDescription;
      desc.style.display = '';
    } else {
      desc.textContent = '';
      desc.style.display = 'none';
    }
    DOM.currentState?.classList.add('fade-in');
  }

  /**
   * Met à jour les blocs Question, Propositions et Explication
   */
  function updateCurrentQuestion(question) {
    const qEl = DOM.currentQuestion;
    const propCont = DOM.adminPropositions;
    const propBlock = DOM.adminBlockPropositions;
    const explCont = DOM.adminExplication;
    const explBlock = DOM.adminBlockExplication;
    if (!qEl) return;
    
    qEl.classList.add('fade-in');
    
    if (!question) {
      qEl.innerHTML = '<em class="text-muted">Aucune question chargée</em>';
      qEl.classList.add('text-muted');
      if (propBlock) propBlock.style.display = 'none';
      if (explBlock) explBlock.style.display = 'none';
      return;
    }
    
    const keyLabels = ['A', 'B', 'C', 'D'];
    const correctIdx = question.bonneReponse;
    const revealed = state.answerRevealed;
    const selectedIdx = (question && question.selectedByAdmin != null) ? Number(question.selectedByAdmin) : null;
    
    qEl.textContent = question.question || '';
    qEl.classList.remove('text-muted');
    
    if (propCont && propBlock) {
      propBlock.style.display = '';
      propCont.innerHTML = (question.propositions || []).map((p, i) => {
        const isCorrect = i === correctIdx;
        const kl = keyLabels[i] || '?';
        let cls = 'admin-proposition-card';
        if (selectedIdx !== null && i === selectedIdx) cls += ' admin-proposition-selected';
        if (revealed && isCorrect) cls += ' admin-proposition-correct';
        if (revealed && selectedIdx !== null && selectedIdx !== correctIdx && i === selectedIdx) cls += ' admin-proposition-wrong';
        return `<div class="${cls}" data-index="${i}"><span class="admin-proposition-label">${kl}</span><span class="admin-proposition-text">${escapeHtml(p)}</span></div>`;
      }).join('');
    }
    
    if (explCont && explBlock) {
      if (revealed && (question.explication || '').trim()) {
        explBlock.style.display = '';
        explCont.textContent = question.explication;
        explCont.classList.add('fade-in');
      } else {
        explBlock.style.display = 'none';
        explCont.textContent = '';
      }
    }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ========================
  // LOAD DATA
  // ========================

  /**
   * Charge les matières depuis le serveur
   */
  async function loadMatieres() {
    try {
      const res = await fetchWithApiKey(`${CONFIG.apiUrl}/matieres`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const matieres = await res.json();
      if (!Array.isArray(matieres)) {
        throw new Error('Format de données invalide');
      }
      
      // Log pour déboguer
      if (CONFIG.isDevelopment) {
        console.log('[ADMIN] Matières reçues:', matieres);
        matieres.forEach(m => {
          console.log(`[ADMIN] Matière ${m.name}:`, {
            id: m.id,
            levels: m.levels,
            levelsType: typeof m.levels,
            isArray: Array.isArray(m.levels)
          });
        });
      }
      
      state.allMatieres = matieres;
      renderMatiereButtons();
      logEvent('✓ Matières chargées: ' + matieres.length);
    } catch (err) {
      if (CONFIG.isDevelopment) {
        console.error('[ADMIN] Erreur chargement matières:', err);
      }
      logEvent('✗ Erreur chargement matières: ' + err.message);
    }
  }

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
   * Charge les catégories depuis le serveur (filtrées par matière si sélectionnée)
   */
  async function loadCategories() {
    try {
      let url = `${CONFIG.apiUrl}/categories`;
      if (state.selectedMatiere?.id) {
        const params = new URLSearchParams();
        params.append('matiereId', state.selectedMatiere.id);
        // Dans le MLD: le niveau filtre indirectement via Theme.idLevel
        if (state.selectedLevel?.id) params.append('levelId', state.selectedLevel.id);
        url += `?${params.toString()}`;
      }
      const res = await fetchWithApiKey(url);
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
      const params = new URLSearchParams();
      params.append('categoryId', categoryId);
      if (state.selectedLevel?.id) params.append('levelId', state.selectedLevel.id);
      const url = `${CONFIG.apiUrl}/themes?${params.toString()}`;
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
   * Mélange un tableau (Fisher-Yates) en place
   */
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Donne la prochaine question du thème sans répétition.
   * Charge toutes les questions du thème, les mélange une fois, puis les enchaîne.
   * Quand le pool est épuisé, remélange et recommence.
   */
  async function getNextQuestionForTheme() {
    const themeId = state.selectedTheme?.id;
    if (!themeId) return null;
    const needNewPool = state.themeQuestionPoolThemeId !== themeId || state.themeQuestionIndex >= state.themeQuestionPool.length;
    if (needNewPool) {
      try {
        const params = new URLSearchParams();
        if (state.selectedMatiere?.id) params.append('matiereId', state.selectedMatiere.id);
        if (state.selectedLevel?.id) params.append('levelId', state.selectedLevel.id);
        if (state.selectedCategory?.id) params.append('categoryId', state.selectedCategory.id);
        params.append('themeId', themeId);
        const res = await fetchWithApiKey(`${CONFIG.apiUrl}/questions?${params.toString()}`);
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(`HTTP ${res.status}`);
        }
        let list = await res.json();
        if (!Array.isArray(list) || list.length === 0) {
          return null;
        }
        const wasExhausted = state.themeQuestionPoolThemeId === themeId && state.themeQuestionIndex >= state.themeQuestionPool.length;
        state.themeQuestionPool = shuffleArray([...list]);
        state.themeQuestionIndex = 0;
        state.themeQuestionPoolThemeId = themeId;
        if (wasExhausted) {
          logEvent(`✓ Toutes les questions du thème vues (${list.length}). Nouveau tirage.`);
        } else {
          logEvent(`✓ ${state.themeQuestionPool.length} question(s) pour ce thème — enchaînement sans répétition.`);
        }
      } catch (err) {
        if (CONFIG.isDevelopment) console.error('[ADMIN] Erreur chargement questions:', err);
        logEvent('✗ Erreur: ' + err.message);
        return null;
      }
    }
    const question = state.themeQuestionPool[state.themeQuestionIndex];
    state.themeQuestionIndex++;
    if (!question || !question.question) return null;
    state.currentQuestion = question;
    const remaining = state.themeQuestionPool.length - state.themeQuestionIndex;
    logEvent(`✓ Question ${state.themeQuestionPool.length - remaining}/${state.themeQuestionPool.length}: "${question.question.substring(0, 40)}..."`);
    return question;
  }

  // ========================
  // RENDER BUTTONS
  // ========================

  /**
   * Crée les boutons de matière
   */
  function renderMatiereButtons() {
    DOM.matieresGrid.innerHTML = '';
    state.allMatieres.forEach((matiere, idx) => {
      const btn = document.createElement('button');
      btn.textContent = matiere.name;
      btn.classList.add('slide-up');
      btn.style.animationDelay = `${idx * 0.05}s`;
      btn.addEventListener('click', () => selectMatiere(matiere));
      DOM.matieresGrid.appendChild(btn);
    });
  }

  /**
   * Crée les boutons de difficulté (filtrés selon la matière)
   */
  function renderLevelButtons() {
    if (!DOM.levelsGrid) {
      if (CONFIG.isDevelopment) {
        console.error('[ADMIN] DOM.levelsGrid n\'existe pas');
      }
      logEvent('✗ Erreur: grille de niveaux introuvable');
      return;
    }
    
    DOM.levelsGrid.innerHTML = '';
    
    // Nouveau modèle (MLD): le niveau est porté par le Thème (Theme.idLevel), pas par Matiere.
    // Donc on affiche tous les niveaux et on filtre ensuite les catégories/thèmes côté API.
    const availableLevels = state.allLevels;
    
    if (availableLevels.length === 0) {
      logEvent('⚠️ Aucun niveau disponible pour cette matière');
      if (CONFIG.isDevelopment) {
        console.warn('[ADMIN] Aucun niveau disponible (liste vide)');
      }
      // Afficher un message dans la grille
      const msg = document.createElement('div');
      msg.textContent = 'Aucun niveau disponible';
      msg.style.padding = 'var(--spacing-md)';
      msg.style.textAlign = 'center';
      msg.style.color = 'var(--color-text-muted)';
      DOM.levelsGrid.appendChild(msg);
      return;
    }
    
    logEvent(`✓ ${availableLevels.length} niveau(x) disponible(s)`);
    
    availableLevels.forEach((level, idx) => {
      const btn = document.createElement('button');
      btn.textContent = level.name;
      btn.classList.add('slide-up');
      btn.style.animationDelay = `${idx * 0.05}s`;
      btn.addEventListener('click', () => selectLevel(level));
      DOM.levelsGrid.appendChild(btn);
    });
  }

  /**
   * Crée les boutons de catégorie
   */
  function renderCategoryButtons() {
    DOM.categoriesGrid.innerHTML = '';
    state.allCategories.forEach((category, idx) => {
      const btn = document.createElement('button');
      btn.textContent = category.name;
      btn.classList.add('slide-up');
      btn.style.animationDelay = `${idx * 0.05}s`;
      btn.addEventListener('click', () => selectCategory(category));
      DOM.categoriesGrid.appendChild(btn);
    });
  }

  // ========================
  // FLOW HANDLERS
  // ========================

  const BUTTON_DEBOUNCE_MS = 800;

  /**
   * Démarre une nouvelle sélection (debounce pour éviter double envoi → overlay revient en arrière)
   */
  let lastStartSelectionAt = 0;
  async function startSelection() {
    if (Date.now() - lastStartSelectionAt < BUTTON_DEBOUNCE_MS) return;
    lastStartSelectionAt = Date.now();

    logEvent('🎬 Nouvelle sélection lancée');
    const matiereScope = getMatiereScope();
    state.screen = matiereScope === MATIERE_SCOPE.HISTOIRE_ONLY ? 'LEVEL_SELECTION' : 'MATIERE_SELECTION';
    state.selectedMatiere = null;
    state.selectedLevel = null;
    state.selectedCategory = null;
    state.selectedTheme = null;
    state.currentQuestion = null;
    state.answerRevealed = false;
    state.themeQuestionPool = [];
    state.themeQuestionIndex = 0;
    state.themeQuestionPoolThemeId = null;
    
    updateUI();
    
    // Charge les matières
    await loadMatieres();
    
    // Envoie la commande à l'overlay
    sendCommand({ type: 'START_SELECTION' });

    if (matiereScope === MATIERE_SCOPE.HISTOIRE_ONLY) {
      const histoire = findHistoireMatiere(state.allMatieres);
      if (!histoire) {
        logEvent(`✗ Matière "${HISTOIRE_MATIERE_NAME}" introuvable - mode toutes matières activé`);
        setMatiereScope(MATIERE_SCOPE.ALL);
        state.screen = 'MATIERE_SELECTION';
        updateUI();
        sendCommand({
          type: 'SHOW_MATIERES_LIST',
          matieres: state.allMatieres,
          selectedId: null
        });
        return;
      }

      // Auto-sélection de la matière Histoire
      state.selectedMatiere = histoire;
      state.selectedLevel = null;
      state.selectedCategory = null;
      state.selectedTheme = null;
      state.themeQuestionPool = [];
      state.themeQuestionIndex = 0;
      state.themeQuestionPoolThemeId = null;
      state.screen = 'LEVEL_SELECTION';
      updateUI();

      // Affiche la "sélection" côté overlay (Histoire)
      sendCommand({
        type: 'SHOW_MATIERES_LIST',
        matieres: [histoire],
        selectedId: histoire.id
      });

      // Charger et afficher les niveaux
      await new Promise(resolve => setTimeout(resolve, 50));
      await loadLevels();

      // Afficher les niveaux côté overlay après le délai habituel
      setTimeout(() => {
        sendCommand({
          type: 'SHOW_LEVELS_LIST',
          levels: state.allLevels,
          selectedId: null
        });
      }, CONFIG.selectionDisplayDelay);

      return;
    }

    sendCommand({
      type: 'SHOW_MATIERES_LIST',
      matieres: state.allMatieres,
      selectedId: null
    });
  }

  /**
   * Sélectionne une matière (debounce pour éviter double envoi de commandes)
   */
  let lastMatiereClickAt = 0;
  async function selectMatiere(matiere) {
    if (Date.now() - lastMatiereClickAt < SELECTION_DEBOUNCE_MS) return;
    lastMatiereClickAt = Date.now();

    logEvent(`📚 Matière sélectionnée: ${matiere.name}`);
    state.selectedMatiere = matiere;
    state.selectedLevel = null;
    state.selectedCategory = null;
    state.selectedTheme = null;
    state.screen = 'LEVEL_SELECTION';
    
    // Met à jour l'UI immédiatement pour afficher la section de sélection de niveau
    updateUI();
    
    // Petit délai pour s'assurer que la section est visible dans le DOM
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Charge les niveaux (seront filtrés dans renderLevelButtons)
    await loadLevels();
    
    // Force le re-render des boutons après le chargement
    renderLevelButtons();
    
    // Envoie la sélection à l'overlay
    sendCommand({
      type: 'SHOW_MATIERES_LIST',
      matieres: state.allMatieres,
      selectedId: matiere.id
    });
    
    // Attend avant d'afficher les niveaux côté overlay
    setTimeout(() => {
      sendCommand({
        type: 'SHOW_LEVELS_LIST',
        levels: state.allLevels,
        selectedId: null
      });
    }, CONFIG.selectionDisplayDelay);
  }

  /**
   * Sélectionne une difficulté (debounce pour éviter double-clic → overlay revient aux difficultés)
   */
  let lastLevelClickAt = 0;
  const SELECTION_DEBOUNCE_MS = 800;
  async function selectLevel(level) {
    if (Date.now() - lastLevelClickAt < SELECTION_DEBOUNCE_MS) return;
    lastLevelClickAt = Date.now();

    logEvent(`🎯 Difficulté sélectionnée: ${level.name}`);
    state.selectedLevel = level;
    state.selectedCategory = null;
    state.selectedTheme = null;
    state.screen = 'CATEGORY_SELECTION';
    
    // Charge les catégories (filtrées par matière)
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
   * Sélectionne une catégorie (debounce pour éviter double envoi)
   */
  let lastCategoryClickAt = 0;
  async function selectCategory(category) {
    if (Date.now() - lastCategoryClickAt < SELECTION_DEBOUNCE_MS) return;
    lastCategoryClickAt = Date.now();

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
   * Tire un thème aléatoire (debounce pour éviter double envoi)
   */
  let lastDrawThemeAt = 0;
  function drawTheme() {
    if (Date.now() - lastDrawThemeAt < BUTTON_DEBOUNCE_MS) return;
    lastDrawThemeAt = Date.now();

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
      matiere: state.selectedMatiere,
      level: state.selectedLevel,
      category: state.selectedCategory
    });
    
    updateUI();
  }

  /**
   * Lance une question (debounce pour éviter double envoi)
   * Si aucune question n'est disponible pour le thème, on affiche un message clair et on reste sur l'écran.
   */
  let lastLaunchQuestionAt = 0;
  async function launchQuestion() {
    if (Date.now() - lastLaunchQuestionAt < BUTTON_DEBOUNCE_MS) return;
    lastLaunchQuestionAt = Date.now();

    logEvent('🚀 Lancement d\'une question...');
    
    const question = await getNextQuestionForTheme();
    if (!question) {
      const themeName = state.selectedTheme?.name || 'ce thème';
      logEvent(`⚠️ Aucune question pour le thème « ${themeName} ». Ajoutez des questions dans votre base (Google Sheet) ou cliquez sur « Tirer un thème » pour en choisir un autre.`);
      state.screen = 'QUESTION_WAITING';
      updateUI();
      return;
    }
    
    state.screen = 'QUESTION_ACTIVE';
    state.answerRevealed = false;
    
    // Envoie la question à l'overlay
    sendCommand({
      type: 'LOAD_QUESTION',
      question: question,
      matiere: state.selectedMatiere,
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
   * Révèle la réponse (debounce pour éviter double envoi)
   */
  let lastRevealAnswerAt = 0;
  function revealAnswer() {
    if (Date.now() - lastRevealAnswerAt < 500) return;
    lastRevealAnswerAt = Date.now();

    if (!state.currentQuestion) {
      alert('Aucune question active');
      return;
    }

    logEvent('✅ Réponse révélée');
    state.answerRevealed = true;
    updateCurrentQuestion(state.currentQuestion);
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
    if (DOM.btnRestartSelectionAlways) {
      DOM.btnRestartSelectionAlways.addEventListener('click', restartSelection);
    }
    
    // Ajoute les boutons A/B/C/D en section active pour sélectionner la réponse
    const keyLabels = ['A', 'B', 'C', 'D'];
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'answer-selection-buttons';
    buttonContainer.style.display = 'none';
    buttonContainer.style.marginTop = 'var(--spacing-md)';
    buttonContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    buttonContainer.style.gap = 'var(--spacing-md)';
    buttonContainer.style.display = 'grid';
    
    keyLabels.forEach((label, idx) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.classList.add('slide-up');
      btn.style.animationDelay = `${idx * 0.1}s`;
      btn.style.padding = 'var(--spacing-md)';
      btn.style.minWidth = '50px';
      btn.style.fontWeight = 'var(--font-weight-bold)';
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
    initMatiereScopeSelect();
    setupEventListeners();
    updateUI();
    logEvent('✓ Admin prêt');
  }

  // Lance l'initialisation
  init();
})();
