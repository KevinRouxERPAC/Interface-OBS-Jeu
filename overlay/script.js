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
  // Récupérer l'API Key depuis l'URL (pour OBS) ou localStorage (pour navigateur)
  // En développement, pas de clé API nécessaire
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const urlParams = new URLSearchParams(window.location.search);
  const apiBaseFromUrl = urlParams.get('apiBase') || urlParams.get('api');
  const origin = window.location.origin;
  const defaultApiUrl = origin + '/api';
  const apiUrl = apiBaseFromUrl
    ? (apiBaseFromUrl.replace(/\/$/, '') + '/api')
    : defaultApiUrl;
  const apiKeyFromUrl = urlParams.get('apiKey') || urlParams.get('apikey');
  const apiKeyFromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('quiz-api-key') : null;

  const CONFIG = {
    channelName: 'quiz-control',
    apiUrl,
    apiKey: isDev ? '' : (apiKeyFromUrl || apiKeyFromStorage || ''),
    pollInterval: 500, // 500ms pour OBS
    defaultTimerDuration: 30, // secondes
    selectionDisplayDelay: 3000, // ms - délai d'affichage des sélections
    errorRetryDelay: 2000, // ms - délai avant retry en cas d'erreur réseau
    maxRetries: 3, // nombre max de tentatives de reconnexion
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
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
    
    // Question
    question: document.getElementById('question'),
    answers: document.getElementById('answers'),
    answerButtons: [], // Rempli au démarrage
    selectionInfoPanel: document.getElementById('selection-info-panel'),
    infoMatiere: document.getElementById('info-matiere'),
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
    flowStep: 0, // 0=attente, 1=matières, 2=niveaux, 3=catégories, 4=thème, 5=question (évite retours en arrière)
    selectedMatiere: null,
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
    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Initialisation de la communication');
    }
    
    // BroadcastChannel (onglets navigateur)
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(CONFIG.channelName);
        channel.onmessage = (evt) => {
          if (CONFIG.isDevelopment) {
            console.log('[OVERLAY] Commande reçue:', evt.data);
          }
          handleCommand(evt.data);
        };
        if (CONFIG.isDevelopment) {
          console.log('[OVERLAY] BroadcastChannel activé');
        }
      } catch (err) {
        if (CONFIG.isDevelopment) {
          console.warn('[OVERLAY] BroadcastChannel échoué:', err);
        }
      }
    }

    // Push via SSE : mise à jour dès qu’une commande est envoyée (pas de polling)
    if (CONFIG.apiUrl && typeof EventSource !== 'undefined') {
      const streamUrl = CONFIG.apiUrl + '/command/stream' + (CONFIG.apiKey ? '?key=' + encodeURIComponent(CONFIG.apiKey) : '');
      try {
        const es = new EventSource(streamUrl);
        es.onmessage = (ev) => {
          try {
            const payload = JSON.parse(ev.data);
            if (!payload || typeof payload.id !== 'number' || payload.id === 0) return;
            if (payload.id === state.lastServerCommandId) return;
            state.lastServerCommandId = payload.id;
            updateConnectionStatus(true);
            if (payload.cmd) handleCommand(payload.cmd);
          } catch (_) {}
        };
        es.onerror = () => {
          updateConnectionStatus(false);
          es.close();
          startPollingFallback();
        };
        if (CONFIG.isDevelopment) {
          console.log('[OVERLAY] Connexion SSE (push) activée');
        }
      } catch (err) {
        if (CONFIG.isDevelopment) console.warn('[OVERLAY] SSE non disponible, fallback polling:', err);
        startPollingFallback();
      }
    } else {
      startPollingFallback();
    }
  }

  let pollingFallbackStarted = false;
  function startPollingFallback() {
    if (pollingFallbackStarted || !CONFIG.apiUrl) return;
    pollingFallbackStarted = true;
    if (CONFIG.isDevelopment) console.log('[OVERLAY] Polling serveur chaque', CONFIG.pollInterval, 'ms');
    setInterval(pollServer, CONFIG.pollInterval);
  }

  let retryCount = 0;
  let lastAuthError = false;
  async function pollServer() {
    try {
      const url = `${CONFIG.apiUrl}/command?t=${Date.now()}`;
      const headers = CONFIG.apiKey ? { 'X-API-Key': CONFIG.apiKey } : {};
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          lastAuthError = true;
          logErrorThrottled(`Authentification échouée (${res.status})`);
          updateConnectionStatus(false, 'auth');
        } else {
          lastAuthError = false;
          logErrorThrottled(`Serveur inaccessible (${res.status})`);
          updateConnectionStatus(false);
        }
        retryCount++;
        return;
      }
      lastAuthError = false;
      const payload = await res.json();
      if (!payload || typeof payload.id !== 'number' || payload.id === 0) return;
      if (payload.id === state.lastServerCommandId) return;
      state.lastServerCommandId = payload.id;
      updateConnectionStatus(true);
      retryCount = 0;
      handleCommand(payload.cmd);
    } catch (err) {
      retryCount++;
      logErrorThrottled(`Serveur déconnecté: ${err.message}`);
      updateConnectionStatus(false);
      if (retryCount <= CONFIG.maxRetries && CONFIG.apiUrl) {
        setTimeout(() => pollServer(), CONFIG.errorRetryDelay * Math.pow(2, retryCount - 1));
      }
    }
  }

  /**
   * Log les erreurs avec throttle (max 1 log par 5s)
   */
  function logErrorThrottled(msg) {
    const now = Date.now();
    if (now - lastErrorLog.time > 5000) {
      if (CONFIG.isDevelopment) {
        console.warn('[OVERLAY]', msg);
      }
      lastErrorLog.time = now;
    }
  }

  /**
   * Met à jour l'indicateur de connexion
   * @param {boolean} connected
   * @param {string} [reason] - 'auth' si 401/403 (clé API manquante ou invalide)
   */
  function updateConnectionStatus(connected, reason) {
    if (!DOM.connectionStatus) return;
    state.lastAdminPing = Date.now();
    
    DOM.connectionStatus.style.display = 'flex';
    DOM.connectionStatus.classList.toggle('connected', connected);
    DOM.connectionStatus.classList.toggle('disconnected', !connected);
    if (DOM.connectionText) {
      if (reason === 'auth') {
        DOM.connectionText.textContent = 'Clé API manquante — Ajoutez ?apiKey=... à l\'URL';
      } else {
        DOM.connectionText.textContent = connected ? 'Synchronisé' : 'Non synchronisé';
      }
    }
  }

  // ========================
  // COMMAND HANDLERS
  // ========================

  // Rang dans le flux : on n'applique pas une commande qui ferait revenir en arrière (sauf START_SELECTION)
  const FLOW_STEP_BY_CMD = {
    START_SELECTION: 0,
    SHOW_MATIERES_LIST: 1,
    SHOW_LEVELS_LIST: 2,
    SHOW_CATEGORIES_LIST: 3,
    SHOW_THEME: 4,
    LOAD_QUESTION: 5
  };

  /**
   * Traite les commandes reçues de l'admin
   */
  function handleCommand(cmd) {
    if (!cmd || typeof cmd !== 'object') return;

    const commandStep = FLOW_STEP_BY_CMD[cmd.type];
    const isReset = cmd.type === 'START_SELECTION';
    const wouldRevert = commandStep !== undefined && commandStep < state.flowStep && !isReset;

    if (wouldRevert) {
      // Ne jamais revenir à un écran précédent (commande ignorée)
      return;
    }

    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Traitement commande:', cmd.type);
    }
    updateConnectionStatus(true);

    switch (cmd.type) {
      case 'START_SELECTION':
        showWaitingScreen();
        break;
        
      case 'SHOW_MATIERES_LIST':
        showMatieresList(cmd.matieres || [], cmd.selectedId);
        break;
        
      case 'SHOW_LEVELS_LIST':
        showLevelsList(cmd.levels || [], cmd.selectedId);
        break;
        
      case 'SHOW_CATEGORIES_LIST':
        showCategoriesList(cmd.categories || [], cmd.selectedId);
        break;
        
      case 'SHOW_THEME':
        showTheme(cmd.theme, cmd.matiere, cmd.level, cmd.category);
        break;
        
      case 'LOAD_QUESTION':
        loadQuestion(cmd.question, cmd.matiere, cmd.level, cmd.category, cmd.theme);
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
        if (CONFIG.isDevelopment) {
          console.warn('[OVERLAY] Commande inconnue:', cmd.type);
        }
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
    
    // Surligne la réponse avec animation pulse
    DOM.answers.querySelectorAll('.answer').forEach((btn, idx) => {
      btn.classList.toggle('highlight', idx === state.selectedAnswerIndex);
      if (idx === state.selectedAnswerIndex) {
        btn.classList.add('glow-purple');
      } else {
        btn.classList.remove('glow-purple');
      }
    });
    
    // Arrête le timer et son son
    clearTimer();
    
    // Joue le son de sélection
    playSound('select');
    
    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Réponse surlignée:', index);
    }
  }

  // ========================
  // SCREEN MANAGEMENT
  // ========================

  /**
   * Affiche l'écran d'attente
   */
  function showWaitingScreen() {
    state.screen = 'WAITING';
    state.flowStep = 0;
    DOM.waitingScreen.style.display = 'block';
    DOM.waitingScreen.classList.add('screen-transition');
    DOM.selectionScreen.style.display = 'none';
    DOM.themeScreen.style.display = 'none';
    DOM.questionScreen.style.display = 'none';
    clearTimer();
    stopSelectSound();
    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Écran d\'attente affiché');
    }
  }

  /**
   * Affiche une liste d'éléments (difficultés ou catégories)
   */
  function showSelectionList(title, items, selectedId, step) {
    state.screen = 'SELECTION';
    if (step != null) state.flowStep = step;
    DOM.waitingScreen.style.display = 'none';
    DOM.selectionScreen.style.display = 'block';
    DOM.selectionScreen.classList.add('screen-transition');
    DOM.themeScreen.style.display = 'none';
    DOM.questionScreen.style.display = 'none';
    
    DOM.selectionTitle.textContent = title;
    DOM.selectionInfo.textContent = '';
    DOM.selectionButtons.innerHTML = '';
    
    if (!Array.isArray(items) || !items.length) {
      const wrapper = document.createElement('div');
      wrapper.className = 'answer card';
      wrapper.innerHTML = '<span class="text text-error">Aucun élément disponible</span>';
      DOM.selectionButtons.appendChild(wrapper);
      return;
    }
    
    // Les touches A/B/C/D
    const keyLabels = ['A', 'B', 'C', 'D'];
    
    items.forEach((item, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'answer card selection-item slide-up';
      wrapper.style.animationDelay = `${idx * 0.1}s`;
      
      const key = document.createElement('div');
      key.className = 'key';
      key.textContent = keyLabels[idx] || String(idx + 1);
      
      const text = document.createElement('div');
      text.className = 'text';
      text.textContent = item.name || `Option ${idx + 1}`;
      
      wrapper.appendChild(key);
      wrapper.appendChild(text);
      
      // Surligne l'élément sélectionné
      if (selectedId && item.id === selectedId) {
        wrapper.classList.add('highlight');
      }
      
      DOM.selectionButtons.appendChild(wrapper);
    });
  }

  /**
   * Affiche la liste des matières
   */
  function showMatieresList(matieres, selectedId) {
    showSelectionList('📚 Choisissez la matière', matieres, selectedId, 1);
    state.selectedMatiere = selectedId;
  }

  /**
   * Affiche la liste des difficultés
   */
  function showLevelsList(levels, selectedId) {
    showSelectionList('🎯 Choisissez la difficulté', levels, selectedId, 2);
    state.selectedLevel = selectedId;
  }

  /**
   * Affiche la liste des catégories
   */
  function showCategoriesList(categories, selectedId) {
    showSelectionList('📂 Choisissez la catégorie', categories, selectedId, 3);
    state.selectedCategory = selectedId;
  }

  /**
   * Affiche l'écran du thème sélectionné
   */
  function showTheme(theme, matiere, level, category) {
    state.screen = 'THEME';
    state.flowStep = 4;
    state.selectedTheme = theme;
    state.selectedMatiere = matiere;
    state.selectedLevel = level;
    state.selectedCategory = category;
    
    DOM.waitingScreen.style.display = 'none';
    DOM.selectionScreen.style.display = 'none';
    DOM.themeScreen.style.display = 'block';
    DOM.themeScreen.classList.add('screen-transition');
    DOM.questionScreen.style.display = 'none';
    
    DOM.themeBreadcrumb.textContent = `${matiere?.name || ''} | ${level?.name || ''} | ${category?.name || ''}`;
    DOM.themeName.textContent = theme.name || 'Thème';
    
    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Thème affiché:', theme.name);
    }
  }

  /**
   * Charge et affiche une question
   */
  function loadQuestion(question, matiere, level, category, theme) {
    state.screen = 'QUESTION';
    state.flowStep = 5;
    state.currentQuestion = question;
    state.selectedMatiere = matiere;
    state.selectedLevel = level;
    state.selectedCategory = category;
    state.selectedTheme = theme;
    state.selectedAnswerIndex = null;
    state.timerDuration = question?.duration || CONFIG.defaultTimerDuration;
    
    DOM.waitingScreen.style.display = 'none';
    DOM.selectionScreen.style.display = 'none';
    DOM.themeScreen.style.display = 'none';
    DOM.questionScreen.style.display = 'block';
    DOM.questionScreen.classList.add('screen-transition');
    
    // Affiche les tags de sélection
    DOM.infoMatiere.textContent = matiere?.name || '-';
    DOM.infoLevel.textContent = level?.name || '-';
    DOM.infoCategory.textContent = category?.name || '-';
    DOM.infoTheme.textContent = theme?.name || '-';
    
    // Affiche la question
    DOM.question.textContent = question.question || 'Question vide';
    DOM.question.classList.add('fade-in');
    
    // Affiche les propositions
    const keyLabels = ['A', 'B', 'C', 'D'];
    DOM.answers.querySelectorAll('.answer').forEach((btn, idx) => {
      btn.querySelector('.key').textContent = keyLabels[idx];
      btn.querySelector('.text').textContent = question.propositions?.[idx] || '';
      btn.classList.remove('correct', 'wrong', 'revealed', 'highlight', 'pulse', 'highlight-correct');
      btn.classList.add('slide-up');
      btn.style.animationDelay = `${idx * 0.1}s`;
    });
    
    // Réinitialise l'explication
    DOM.questionExplanation.style.display = 'none';
    DOM.explanationText.textContent = '';
    
    // Démarre le timer
    restartTimer(state.timerDuration);
    
    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Question affichée:', question.question?.substring(0, 50));
    }
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
        if (CONFIG.isDevelopment) {
          console.log('[OVERLAY] Timer terminé - Révélation automatique');
        }
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
      if (CONFIG.isDevelopment) {
        console.warn('[OVERLAY] Pas de question actuelle');
      }
      return;
    }
    
    clearTimer();
    
    // Arrête le son de sélection s'il est en cours
    stopSelectSound();
    
    const correctIndex = Number(state.currentQuestion.bonneReponse);
    const answers = DOM.answers.querySelectorAll('.answer');
    
    answers.forEach((btn, idx) => {
      // Important: on retire la surbrillance violette de sélection, sinon elle peut masquer
      // le vert/rouge (le CSS .answer.highlight est déclaré après .answer.correct/.wrong).
      btn.classList.remove('highlight', 'glow-purple', 'pulse', 'highlight-correct', 'wrong', 'correct');
      btn.classList.add('revealed');
      
      if (idx === correctIndex) {
        // La bonne réponse est toujours verte avec animation highlight
        btn.classList.add('correct', 'pulse');
      } else if (idx === state.selectedAnswerIndex && state.selectedAnswerIndex !== correctIndex) {
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
    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Réponse révélée (correcte:', correctIndex, ', sélectionnée:', state.selectedAnswerIndex, ')');
    }
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
          // Arrête le son précédent s'il existe
          stopSelectSound();
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
      
      // Fallback vers chemin relatif si API non disponible
      const audioUrl = !CONFIG.isDevelopment
        ? `${window.location.origin}/overlay/audio/${soundFile}`
        : `audio/${soundFile}`;
      
      const audio = new Audio(audioUrl);
      audio.volume = volume;
      
      // Stocke la référence pour le son de sélection
      if (soundType === 'select') {
        state.selectAudio = audio;
      }
      
      audio.play().catch(err => {
        if (CONFIG.isDevelopment) {
          console.warn(`[OVERLAY] Son ${soundType} échoué:`, err);
        }
      });
    } catch (err) {
      if (CONFIG.isDevelopment) {
        console.warn('[OVERLAY] Erreur création audio:', err);
      }
    }
  }

  /**
   * Arrête le son de sélection
   */
  function stopSelectSound() {
    if (state.selectAudio) {
      state.selectAudio.pause();
      state.selectAudio.currentTime = 0;
      state.selectAudio = null;
    }
  }

  /**
   * Joue la musique du timer
   */
  function playTimerSound() {
    try {
      // Fallback vers chemin relatif si API non disponible
      const audioUrl = !CONFIG.isDevelopment
        ? `${window.location.origin}/overlay/audio/30secondes.wav`
        : `audio/30secondes.wav`;
      
      state.timerAudio = new Audio(audioUrl);
      state.timerAudio.volume = 0.4;
      state.timerAudio.loop = true;
      state.timerAudio.play().catch(err => {
        if (CONFIG.isDevelopment) {
          console.warn('[OVERLAY] Timer audio échoué:', err);
        }
      });
    } catch (err) {
      if (CONFIG.isDevelopment) {
        console.warn('[OVERLAY] Erreur création audio:', err);
      }
    }
  }

  // ========================
  // INITIALIZATION
  // ========================

  /**
   * Initialise le script au démarrage
   */
  function init() {
    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Démarrage de l\'overlay');
    }
    
    // Récupère les boutons des réponses
    DOM.answerButtons = Array.from(DOM.answers.querySelectorAll('.answer'));
    
    // Initialise la communication
    initChannel();
    
    // Affiche l'écran d'attente
    showWaitingScreen();
    
    if (CONFIG.isDevelopment) {
      console.log('[OVERLAY] Overlay prêt');
    }
  }

  // Lance l'initialisation
  init();
})();
