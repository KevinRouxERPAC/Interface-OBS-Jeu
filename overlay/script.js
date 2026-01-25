/**
 * OVERLAY SCRIPT
 * Affiche le quiz au public dans OBS
 * Reçoit les commandes de l'admin et affiche l'état en temps réel
 * Aucun contrôle du public : lecture seule
 */

(() => {
  // ========================
  // CONFIG & CONSTANTS
  // ========================
  const CONFIG = {
    channelName: 'quiz-control',
    apiUrl: 'http://localhost:3000',
    apiKey: localStorage.getItem('quiz-api-key') || '',
    pollInterval: 500, // 500ms pour OBS
    defaultTimerDuration: 30 // secondes
  };

  // ========================
  // DOM ELEMENTS
  // ========================
  const DOM = {
    overlay: document.getElementById('overlay'),
    connectionStatus: document.getElementById('connection-status'),
    connectionText: document.querySelector('#connection-status .text'),
    
    // Écrans
    waitingScreen: document.getElementById('waiting-screen'),
    selectionScreen: document.getElementById('selection-screen'),
    themeScreen: document.getElementById('theme-screen'),
    questionScreen: document.getElementById('question-screen'),
    
    // Sélection
    selectionTitle: document.getElementById('selection-title'),
    selectionInfo: document.getElementById('selection-info'),
    selectionButtons: document.getElementById('selection-buttons'),
    
    // Thème
    themeBreadcrumb: document.getElementById('theme-breadcrumb'),
    themeName: document.getElementById('theme-name'),
    themeDescription: document.getElementById('theme-description'),
    
    // Question
    question: document.getElementById('question'),
    answers: document.getElementById('answers'),
    answerButtons: [], // Rempli au démarrage
    selectionInfoPanel: document.getElementById('selection-info-panel'),
    infoLevel: document.getElementById('info-level'),
    infoCategory: document.getElementById('info-category'),
    infoTheme: document.getElementById('info-theme'),
    
    // Timer
    timerFill: document.getElementById('timer-fill'),
    timerText: document.getElementById('timer-text'),
    questionExplanation: document.getElementById('question-explanation'),
    explanationText: document.getElementById('explanation-text')
  };

  // ========================
  // STATE
  // ========================
  let state = {
    screen: 'WAITING', // WAITING, SELECTION, THEME, QUESTION
    selectedLevel: null,
    selectedCategory: null,
    selectedTheme: null,
    currentQuestion: null,
    timerDuration: CONFIG.defaultTimerDuration,
    selectedAnswerIndex: null,
    lastServerCommandId: 0,
    lastAdminPing: Date.now(),
    timerId: null,
    timerAudio: null,
    selectAudio: null
  };

  // ========================
  // COMMUNICATION
  // ========================
  let channel = null;
  const lastErrorLog = { time: 0 };

  /**
   * Initialise la communication avec l'admin
   */
  function initChannel() {
    console.log('[OVERLAY] Initialisation de la communication');
    
    // BroadcastChannel (onglets navigateur)
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(CONFIG.channelName);
        channel.onmessage = (evt) => {
          console.log('[OVERLAY] Commande reçue:', evt.data);
          handleCommand(evt.data);
        };
        console.log('[OVERLAY] BroadcastChannel activé');
      } catch (err) {
        console.warn('[OVERLAY] BroadcastChannel échoué:', err);
      }
    }

    // Polling serveur (PRINCIPAL pour OBS)
    console.log('[OVERLAY] Polling serveur chaque', CONFIG.pollInterval, 'ms');
    setInterval(pollServer, CONFIG.pollInterval);
  }

  /**
   * Récupère les dernières commandes du serveur
   */
  async function pollServer() {
    try {
      const url = `${CONFIG.apiUrl}/command?t=${Date.now()}`;
      const headers = CONFIG.apiKey ? { 'X-API-Key': CONFIG.apiKey } : {};
      const res = await fetch(url, { headers, cache: 'no-store' });
      
      if (!res.ok) {
        logErrorThrottled(`Serveur inaccessible (${res.status})`);
        updateConnectionStatus(false);
        return;
      }
      
      const payload = await res.json();
      if (!payload || typeof payload.id !== 'number' || payload.id === 0) return;
      if (payload.id === state.lastServerCommandId) return;
      
      state.lastServerCommandId = payload.id;
      updateConnectionStatus(true);
      handleCommand(payload.cmd);
    } catch (err) {
      logErrorThrottled(`Serveur déconnecté: ${err.message}`);
      updateConnectionStatus(false);
    }
  }

  /**
   * Log les erreurs avec throttle (max 1 log par 5s)
   */
  function logErrorThrottled(msg) {
    const now = Date.now();
    if (now - lastErrorLog.time > 5000) {
      console.warn('[OVERLAY]', msg);
      lastErrorLog.time = now;
    }
  }

  /**
   * Met à jour l'indicateur de connexion
   */
  function updateConnectionStatus(connected) {
    if (!DOM.connectionStatus) return;
    state.lastAdminPing = Date.now();
    
    DOM.connectionStatus.classList.toggle('connected', connected);
    DOM.connectionStatus.classList.toggle('disconnected', !connected);
    if (DOM.connectionText) {
      DOM.connectionText.textContent = connected ? 'Synchronisé' : 'Non synchronisé';
    }
  }

  // ========================
  // COMMAND HANDLERS
  // ========================

  /**
   * Traite les commandes reçues de l'admin
   */
  function handleCommand(cmd) {
    if (!cmd || typeof cmd !== 'object') return;
    
    console.log('[OVERLAY] Traitement commande:', cmd.type);
    updateConnectionStatus(true);
    
    switch (cmd.type) {
      case 'START_SELECTION':
        showWaitingScreen();
        break;
        
      case 'SHOW_LEVELS_LIST':
        showLevelsList(cmd.levels || [], cmd.selectedId);
        break;
        
      case 'SHOW_CATEGORIES_LIST':
        showCategoriesList(cmd.categories || [], cmd.selectedId);
        break;
        
      case 'SHOW_THEME':
        showTheme(cmd.theme, cmd.level, cmd.category);
        break;
        
      case 'LOAD_QUESTION':
        loadQuestion(cmd.question, cmd.level, cmd.category, cmd.theme);
        break;
        
      case 'REVEAL_ANSWER':
        revealAnswer();
        break;
        
      case 'RESTART_TIMER':
        state.timerDuration = cmd.duration || CONFIG.defaultTimerDuration;
        restartTimer(state.timerDuration);
        break;
        
      case 'HIGHLIGHT_ANSWER':
        highlightAnswer(cmd.index);
        break;
        
      default:
        console.warn('[OVERLAY] Commande inconnue:', cmd.type);
    }
  }

  // ========================
  // ANSWER HIGHLIGHT
  // ========================

  /**
   * Surligne une réponse (sélectionnée par l'admin)
   */
  function highlightAnswer(index) {
    if (index == null) return;
    state.selectedAnswerIndex = Number(index);
    
    // Surligne la réponse
    DOM.answers.querySelectorAll('.answer').forEach((btn, idx) => {
      btn.classList.toggle('highlight', idx === state.selectedAnswerIndex);
    });
    
    // Joue le son de sélection
    playSound('select');
    
    console.log('[OVERLAY] Réponse surlignée:', index);
  }

  // ========================
  // SCREEN MANAGEMENT
  // ========================

  /**
   * Affiche l'écran d'attente
   */
  function showWaitingScreen() {
    state.screen = 'WAITING';
    DOM.waitingScreen.style.display = 'block';
    DOM.selectionScreen.style.display = 'none';
    DOM.themeScreen.style.display = 'none';
    DOM.questionScreen.style.display = 'none';
    clearTimer();
    console.log('[OVERLAY] Écran d\'attente affiché');
  }

  /**
   * Affiche une liste d'éléments (difficultés ou catégories)
   */
  function showSelectionList(title, items, selectedId) {
    state.screen = 'SELECTION';
    DOM.waitingScreen.style.display = 'none';
    DOM.selectionScreen.style.display = 'block';
    DOM.themeScreen.style.display = 'none';
    DOM.questionScreen.style.display = 'none';
    
    DOM.selectionTitle.textContent = title;
    DOM.selectionInfo.textContent = '';
    DOM.selectionButtons.innerHTML = '';
    
    if (!Array.isArray(items) || !items.length) {
      const wrapper = document.createElement('div');
      wrapper.className = 'answer';
      wrapper.innerHTML = '<span class="text">Aucun élément disponible</span>';
      wrapper.style.color = '#ff6b6b';
      DOM.selectionButtons.appendChild(wrapper);
      return;
    }
    
    // Les touches A/B/C/D
    const keyLabels = ['A', 'B', 'C', 'D'];
    
    items.forEach((item, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'answer selection-item';
      
      const key = document.createElement('div');
      key.className = 'key';
      key.textContent = keyLabels[idx] || String(idx + 1);
      
      const text = document.createElement('div');
      text.className = 'text';
      text.textContent = item.name || `Option ${idx + 1}`;
      
      wrapper.appendChild(key);
      wrapper.appendChild(text);
      
      // Surligna l'élément sélectionné
      if (selectedId && item.id === selectedId) {
        wrapper.classList.add('highlight');
      }
      
      DOM.selectionButtons.appendChild(wrapper);
    });
  }

  /**
   * Affiche la liste des difficultés
   */
  function showLevelsList(levels, selectedId) {
    showSelectionList('🎯 Choisissez la difficulté', levels, selectedId);
    state.selectedLevel = selectedId;
  }

  /**
   * Affiche la liste des catégories
   */
  function showCategoriesList(categories, selectedId) {
    showSelectionList('📂 Choisissez la catégorie', categories, selectedId);
    state.selectedCategory = selectedId;
  }

  /**
   * Affiche l'écran du thème sélectionné
   */
  function showTheme(theme, level, category) {
    state.screen = 'THEME';
    state.selectedTheme = theme;
    state.selectedLevel = level;
    state.selectedCategory = category;
    
    DOM.waitingScreen.style.display = 'none';
    DOM.selectionScreen.style.display = 'none';
    DOM.themeScreen.style.display = 'block';
    DOM.questionScreen.style.display = 'none';
    
    DOM.themeBreadcrumb.textContent = `${level?.name || ''} | ${category?.name || ''}`;
    DOM.themeName.textContent = theme.name || 'Thème';
    DOM.themeDescription.textContent = theme.description || '';
    
    console.log('[OVERLAY] Thème affiché:', theme.name);
  }

  /**
   * Charge et affiche une question
   */
  function loadQuestion(question, level, category, theme) {
    state.screen = 'QUESTION';
    state.currentQuestion = question;
    state.selectedLevel = level;
    state.selectedCategory = category;
    state.selectedTheme = theme;
    state.selectedAnswerIndex = null;
    state.timerDuration = question?.duration || CONFIG.defaultTimerDuration;
    
    DOM.waitingScreen.style.display = 'none';
    DOM.selectionScreen.style.display = 'none';
    DOM.themeScreen.style.display = 'none';
    DOM.questionScreen.style.display = 'block';
    
    // Affiche les tags de sélection
    DOM.infoLevel.textContent = level?.name || '-';
    DOM.infoCategory.textContent = category?.name || '-';
    DOM.infoTheme.textContent = theme?.name || '-';
    
    // Affiche la question
    DOM.question.textContent = question.question || 'Question vide';
    
    // Affiche les propositions
    const keyLabels = ['A', 'B', 'C', 'D'];
    DOM.answers.querySelectorAll('.answer').forEach((btn, idx) => {
      btn.querySelector('.key').textContent = keyLabels[idx];
      btn.querySelector('.text').textContent = question.propositions?.[idx] || '';
      btn.classList.remove('correct', 'wrong', 'revealed', 'highlight', 'pulse');
    });
    
    // Réinitialise l'explication
    DOM.questionExplanation.style.display = 'none';
    DOM.explanationText.textContent = '';
    
    // Démarre le timer
    restartTimer(state.timerDuration);
    
    console.log('[OVERLAY] Question affichée:', question.question?.substring(0, 50));
  }

  // ========================
  // TIMER
  // ========================

  /**
   * Démarre ou relance le timer
   */
  function restartTimer(duration) {
    clearTimer();
    state.timerDuration = duration;
    
    const totalMs = duration * 1000;
    const startedAt = performance.now();
    
    // Réinitialise la barre
    DOM.timerFill.style.transition = 'none';
    DOM.timerFill.style.width = '100%';
    void DOM.timerFill.offsetWidth; // Force reflow
    
    // Lance la musique de timer (si disponible)
    playTimerSound();
    
    // Anime la barre
    requestAnimationFrame(() => {
      DOM.timerFill.style.transition = `width ${duration}s linear`;
      DOM.timerFill.style.width = '0%';
    });
    
    // Boucle du timer
    state.timerId = requestAnimationFrame(function tick(now) {
      const elapsed = now - startedAt;
      const remaining = Math.max(0, totalMs - elapsed);
      
      updateTimerLabel(Math.ceil(remaining / 1000));
      
      if (remaining <= 0) {
        clearTimer();
        // Révélation automatique quand le timer arrive à 0
        console.log('[OVERLAY] Timer terminé - Révélation automatique');
        revealAnswer();
        return;
      }
      
      state.timerId = requestAnimationFrame(tick);
    });
  }

  /**
   * Met à jour le label du timer
   */
  function updateTimerLabel(seconds) {
    DOM.timerText.textContent = `${seconds}s`;
  }

  /**
   * Arrête le timer
   */
  function clearTimer() {
    if (state.timerId) {
      cancelAnimationFrame(state.timerId);
      state.timerId = null;
    }
    
    // Arrête la musique du timer
    if (state.timerAudio) {
      state.timerAudio.pause();
      state.timerAudio.currentTime = 0;
      state.timerAudio = null;
    }
    
    // Fige la barre
    if (DOM.timerFill) {
      const currentWidth = DOM.timerFill.getBoundingClientRect().width;
      const parentWidth = DOM.timerFill.parentElement.getBoundingClientRect().width;
      const percentage = (currentWidth / parentWidth) * 100;
      DOM.timerFill.style.transition = 'none';
      DOM.timerFill.style.width = `${percentage}%`;
    }
  }

  // Pas de sélection de réponse par le public
  // L'admin sélectionne la réponse depuis l'interface admin

  // ========================
  // ANSWER REVEAL
  // ========================

  /**
   * Révèle la bonne réponse
   */
  function revealAnswer() {
    if (!state.currentQuestion) {
      console.warn('[OVERLAY] Pas de question actuelle');
      return;
    }
    
    clearTimer();
    
    const correctIndex = Number(state.currentQuestion.bonneReponse);
    const answers = DOM.answers.querySelectorAll('.answer');
    
    answers.forEach((btn, idx) => {
      btn.classList.add('revealed');
      
      if (idx === correctIndex) {
        // La bonne réponse est toujours verte
        btn.classList.add('correct', 'pulse');
      } else if (idx === state.selectedAnswerIndex) {
        // La réponse sélectionnée par l'admin : rouge si fausse
        btn.classList.add('wrong');
      }
    });
    
    // Joue le son approprié
    if (state.selectedAnswerIndex === correctIndex) {
      playSound('correct');
    } else if (state.selectedAnswerIndex !== null) {
      playSound('wrong');
    }
    
    // L'explication n'est affichée que côté admin, pas sur l'overlay public
    console.log('[OVERLAY] Réponse révélée (correcte:', correctIndex, ', sélectionnée:', state.selectedAnswerIndex, ')');
  }

  // ========================
  // AUDIO
  // ========================

  /**
   * Joue un son audio
   */
  function playSound(soundType) {
    try {
      let soundFile;
      let volume = 0.7;
      
      switch (soundType) {
        case 'select':
          soundFile = 'select.wav';
          break;
        case 'correct':
          soundFile = 'correct.wav';
          break;
        case 'wrong':
          soundFile = 'wrong.wav';
          break;
        case 'timer':
          soundFile = '30secondes.wav';
          volume = 0.4;
          break;
        default:
          return;
      }
      
      const audioUrl = `${CONFIG.apiUrl}/overlay/audio/${soundFile}`;
      const audio = new Audio(audioUrl);
      audio.volume = volume;
      audio.play().catch(err => console.warn(`[OVERLAY] Son ${soundType} échoué:`, err));
    } catch (err) {
      console.warn('[OVERLAY] Erreur création audio:', err);
    }
  }

  /**
   * Joue la musique du timer
   */
  function playTimerSound() {
    try {
      const audioUrl = `${CONFIG.apiUrl}/overlay/audio/30secondes.wav`;
      state.timerAudio = new Audio(audioUrl);
      state.timerAudio.volume = 0.4;
      state.timerAudio.loop = true;
      state.timerAudio.play().catch(err => console.warn('[OVERLAY] Timer audio échoué:', err));
    } catch (err) {
      console.warn('[OVERLAY] Erreur création audio:', err);
    }
  }

  // ========================
  // INITIALIZATION
  // ========================

  /**
   * Initialise le script au démarrage
   */
  function init() {
    console.log('[OVERLAY] Démarrage de l\'overlay');
    
    // Récupère les boutons des réponses
    DOM.answerButtons = Array.from(DOM.answers.querySelectorAll('.answer'));
    
    // Initialise la communication
    initChannel();
    
    // Affiche l'écran d'attente
    showWaitingScreen();
    
    console.log('[OVERLAY] Overlay prêt');
  }

  // Lance l'initialisation
  init();
})();
