(() => {
  const DEFAULT_DURATION = 30;
  const channelName = 'quiz-control';
  const POLL_INTERVAL_MS = 500; // 500ms pour OBS
  const API_URL = 'http://localhost:3000';
  const RANDOM_URL = `${API_URL}/random`;
  const API_KEY = localStorage.getItem('quiz-api-key') || ''; // Clé API optionnelle
  const COMMAND_POLL_URL = `${API_URL}/command`;
  
  let lastCommandRaw = null;
  let lastServerCommandId = 0;
  let lastErrorLog = 0;
  const ERROR_LOG_THROTTLE = 5000; // Log errors max every 5s
  
  const questionEl = document.getElementById('question');
  const answersEl = document.getElementById('answers');
  const timerFill = document.getElementById('timer-fill');
  const timerText = document.getElementById('timer-text');
  const selectionPanel = document.getElementById('selection-panel');
  const selectionTitle = document.getElementById('selection-title');
  const selectionInfo = document.getElementById('selection-info');
  const selectionButtons = document.getElementById('selection-buttons');
  const selectionInfoPanel = document.getElementById('selection-info-panel');
  const infoLevel = document.getElementById('info-level');
  const infoCategory = document.getElementById('info-category');
  const infoTheme = document.getElementById('info-theme');

  let timerId = null;
  let currentQuestion = null;
  let timerDuration = DEFAULT_DURATION;
  let channel = null;
  let selectedIndex = null;
  let timerAudio = null;
  let selectAudio = null;
  let lastAdminPing = 0;
  let selectedLevel = null;
  let selectedCategory = null;
  let selectedTheme = null;
  const connectionStatusEl = document.getElementById('connection-status');
  const connectionTextEl = connectionStatusEl?.querySelector('.text');

  // Audio
  const audioSources = {
    timer: `${API_URL}/overlay/audio/30secondes.wav`,
    correct: `${API_URL}/overlay/audio/correct.wav`,
    wrong: `${API_URL}/overlay/audio/wrong.wav`,
    select: `${API_URL}/overlay/audio/select.wav`
  };
  
  // Fonction utilitaire pour envoyer des requêtes avec la clé API
  function fetchWithApiKey(url, options = {}) {
    const headers = { ...options.headers };
    if (API_KEY) {
      headers['X-API-Key'] = API_KEY;
    }
    return fetch(url, { ...options, headers });
  }

  // Préchargement des sons
  const audioCache = {};
  Object.keys(audioSources).forEach(key => {
    const audio = new Audio(audioSources[key]);
    audio.preload = 'auto';
    audio.volume = 0.7;
    audioCache[key] = audio;
  });

  function playSound(type = 'timer') {
    if (!audioCache[type]) {
      console.warn('Son non trouvé:', type);
      return;
    }
    
    try {
      const audio = audioCache[type].cloneNode();
      audio.volume = 0.7;
      audio.currentTime = 0;
      
      // Tracker le son de sélection pour pouvoir l'arrêter plus tard
      if (type === 'select') {
        // Arrêter le son précédent s'il existe
        if (selectAudio) {
          selectAudio.pause();
          selectAudio.currentTime = 0;
        }
        audio.loop = true; // Boucler le son de sélection
        selectAudio = audio;
      }
      
      audio.play()
        .then(() => console.log('Audio joué:', type))
        .catch(err => console.warn('Erreur lecture audio:', type, err));
    } catch (err) {
      console.warn('Erreur création audio:', type, err);
    }
  }

  const keyLabels = ['A', 'B', 'C', 'D'];

  function initChannel() {
    console.log('[OVERLAY] Initialisation de la communication...');
    
    // BroadcastChannel (fonctionne entre onglets browser, pas avec OBS)
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(channelName);
        channel.onmessage = (event) => {
          console.log('[OVERLAY] Commande via BroadcastChannel:', event.data);
          handleCommand(event.data);
        };
        console.log('[OVERLAY] BroadcastChannel activé');
      } catch (err) {
        console.warn('[OVERLAY] BroadcastChannel échoué:', err);
      }
    }

    // Poll serveur (PRINCIPAL pour OBS)
    console.log('[OVERLAY] Démarrage du polling serveur toutes les', POLL_INTERVAL_MS, 'ms');
    setInterval(async () => {
      try {
        const res = await fetchWithApiKey(COMMAND_POLL_URL + '?t=' + Date.now(), { 
          cache: 'no-store'
        });
        if (!res.ok) {
          const now = Date.now();
          if (now - lastErrorLog > ERROR_LOG_THROTTLE) {
            console.warn('[OVERLAY] Serveur inaccessible (status:', res.status + ')');
            lastErrorLog = now;
          }
          return;
        }
        const payload = await res.json();
        if (!payload || typeof payload.id !== 'number') return;
        if (payload.id === 0 || payload.id === lastServerCommandId) return;
        
        console.log('[OVERLAY] Nouvelle commande serveur #' + payload.id + ':', payload.cmd);
        lastServerCommandId = payload.id;
        handleCommand(payload.cmd);
      } catch (err) {
        const now = Date.now();
        if (now - lastErrorLog > ERROR_LOG_THROTTLE) {
          console.error('[OVERLAY] Serveur déconnecté -', err.message);
          lastErrorLog = now;
        }
      }
    }, POLL_INTERVAL_MS);
  }

  function updateConnectionStatus(connected) {
    if (!connectionStatusEl) return;
    if (connected) {
      connectionStatusEl.classList.remove('disconnected');
      connectionStatusEl.classList.add('connected');
      if (connectionTextEl) connectionTextEl.textContent = 'Synchronisé';
      lastAdminPing = Date.now();
    } else {
      connectionStatusEl.classList.remove('connected');
      connectionStatusEl.classList.add('disconnected');
      if (connectionTextEl) connectionTextEl.textContent = 'Non synchronisé';
    }
  }

  // Vérifier la connexion toutes les 3 secondes
  setInterval(() => {
    const timeSinceLastPing = Date.now() - lastAdminPing;
    if (timeSinceLastPing > 5000) {
      updateConnectionStatus(false);
    }
  }, 3000);

  function postMessage(cmd) {
    if (channel) {
      channel.postMessage(cmd);
    } else {
      localStorage.setItem('quiz-state', JSON.stringify(cmd));
    }
  }

  async function fetchRandomQuestion(levelId, categoryId, themeId) {
    // Try API first
    try {
      let url = `${RANDOM_URL}?t=${Date.now()}`;
      if (levelId) url += `&levelId=${levelId}`;
      if (categoryId) url += `&categoryId=${categoryId}`;
      if (themeId) url += `&themeId=${themeId}`;
      
      const res = await fetchWithApiKey(url, { cache: 'no-store' });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('API non disponible, fallback JSON', err);
    }

    // Fallback to local JSON file
    const res = await fetch('../data/questions.json?' + Date.now(), { cache: 'no-store' });
    const list = await res.json();
    const pick = list[Math.floor(Math.random() * list.length)];
    return pick;
  }

  function displayQuestion(question) {
    currentQuestion = question;
    timerDuration = question?.duration || DEFAULT_DURATION;
    selectedIndex = null;

    // Arrêter le son de sélection lors du changement de question
    if (selectAudio) {
      selectAudio.pause();
      selectAudio.currentTime = 0;
      selectAudio = null;
    }

    // Reset overlay alert state
    const overlayEl = document.getElementById('overlay');
    overlayEl?.classList.remove('alert');

    questionEl.textContent = question.question;

    const answerNodes = Array.from(answersEl.querySelectorAll('.answer'));
    answerNodes.forEach((node, idx) => {
      node.classList.remove('correct', 'revealed', 'highlight', 'wrong', 'pulse');
      node.querySelector('.key').textContent = keyLabels[idx] || String(idx + 1);
      node.querySelector('.text').textContent = question.propositions[idx] || '';
    });

    updateTimerLabel(timerDuration);
    restartTimer(timerDuration);
    broadcastState();
  }

  function updateTimerLabel(value) {
    timerText.textContent = `${Math.ceil(value)}s`;
  }

  function restartTimer(duration = DEFAULT_DURATION) {
    clearTimer();
    const totalMs = duration * 1000;
    timerFill.style.transition = 'none';
    timerFill.style.width = '100%';
    // Force reflow pour réinitialiser l'animation
    void timerFill.offsetWidth;

    // Démarrer la musique de timer en boucle
    if (audioCache.timer) {
      timerAudio = audioCache.timer.cloneNode();
      timerAudio.loop = true;
      timerAudio.volume = 0.4;
      timerAudio.play().catch(err => console.warn('Timer audio failed:', err));
    }

    requestAnimationFrame(() => {
      timerFill.style.transition = `width ${duration}s linear`;
      timerFill.style.width = '0%';
    });

    const startedAt = performance.now();
    timerId = requestAnimationFrame(function tick(now) {
      const elapsed = now - startedAt;
      const remaining = Math.max(0, totalMs - elapsed);
      updateTimerLabel(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        timerFill.style.width = '0%';
        timerId = null;
        // Arrêter la musique du timer
        if (timerAudio) {
          timerAudio.pause();
          timerAudio.currentTime = 0;
          timerAudio = null;
        }
        postMessage({ type: 'TIMER_END' });
        revealAnswer(); // Révélation automatique quand le timer atteint 0
        return;
      }
      timerId = requestAnimationFrame(tick);
    });
  }

  function clearTimer() {
    if (timerId) {
      cancelAnimationFrame(timerId);
      timerId = null;
    }
    // Arrêter la musique du timer
    if (timerAudio) {
      timerAudio.pause();
      timerAudio.currentTime = 0;
      timerAudio = null;
    }
    // Figer la barre de progression à sa position actuelle
    if (timerFill) {
      const currentWidth = timerFill.getBoundingClientRect().width;
      const parentWidth = timerFill.parentElement.getBoundingClientRect().width;
      const percentage = (currentWidth / parentWidth) * 100;
      timerFill.style.transition = 'none';
      timerFill.style.width = `${percentage}%`;
    }
  }

  function revealAnswer() {
    if (!currentQuestion) return;
    
    // Vérifier qu'une réponse est sélectionnée
    if (selectedIndex == null) {
      console.warn('[OVERLAY] Aucune réponse sélectionnée, révélation annulée');
      return;
    }
    
    // Arrêter le son de sélection s'il est en cours
    if (selectAudio) {
      selectAudio.pause();
      selectAudio.currentTime = 0;
      selectAudio = null;
    }
    
    // Arrêter la musique du timer
    if (timerAudio) {
      timerAudio.pause();
      timerAudio.currentTime = 0;
      timerAudio = null;
    }
    
    clearTimer();
    
    const overlayEl = document.getElementById('overlay');
    
    const correctIndex = Number(currentQuestion.bonneReponse);
    const nodes = Array.from(answersEl.querySelectorAll('.answer'));
    
    nodes.forEach((node, idx) => {
      const isCorrect = idx === correctIndex;
      node.classList.add('revealed');
      
      if (isCorrect) {
        node.classList.add('correct');
        // Animation pulse pour la bonne réponse
        setTimeout(() => node.classList.add('pulse'), 50);
      } else if (idx === selectedIndex) {
        // Marquer visuellement la mauvaise réponse sélectionnée
        node.classList.add('wrong');
      }
    });

    if (selectedIndex != null) {
      const isCorrect = selectedIndex === correctIndex;
      console.log('Révélation - selectedIndex:', selectedIndex, 'correctIndex:', correctIndex, 'isCorrect:', isCorrect);
      
      // Petit délai avant le son pour laisser l'animation se lancer
      setTimeout(() => {
        playSound(isCorrect ? 'correct' : 'wrong');
      }, 100);
      
      if (!isCorrect && overlayEl) {
        overlayEl.classList.add('alert');
        // Retrait automatique de l'alerte après 2.5s
        setTimeout(() => overlayEl.classList.remove('alert'), 2500);
      }
    }
    
    postMessage({ type: 'ANSWER_REVEALED', id: currentQuestion.id });
  }

  function highlightAnswer(index) {
    if (index == null) return;
    playSound('select');
    const nodes = Array.from(answersEl.querySelectorAll('.answer'));
    nodes.forEach((node, idx) => {
      node.classList.toggle('highlight', idx === Number(index));
    });
    selectedIndex = Number(index);
    clearTimer(); // Arrêt du timer et de la musique quand une réponse est sélectionnée
    broadcastState();
  }

  function showLevelSelection(level) {
    // Cacher la question et les réponses
    questionEl.style.display = 'none';
    answersEl.style.display = 'none';
    selectionInfoPanel.style.display = 'none';
    
    // Afficher le panneau de sélection
    selectionPanel.style.display = 'flex';
    selectionTitle.textContent = '🎯 Difficulté sélectionnée';
    selectionInfo.textContent = level.name;
    selectionInfo.style.fontSize = '32px';
    selectionInfo.style.fontWeight = '700';
    selectionInfo.style.color = '#42e8c4';
    selectionInfo.style.textAlign = 'center';
    selectionInfo.style.marginTop = '20px';
    selectionButtons.innerHTML = '';
    selectionButtons.style.display = 'none';
    
    selectedLevel = level;
  }

  function showCategorySelection(category) {
    // Afficher la catégorie sélectionnée
    selectionTitle.textContent = '📂 Catégorie sélectionnée';
    selectionInfo.textContent = category.name;
    selectionInfo.style.fontSize = '32px';
    selectionInfo.style.fontWeight = '700';
    selectionInfo.style.color = '#7c5dff';
    
    selectedCategory = category;
  }

  function renderSelectionList(title, items, selectedId) {
    questionEl.style.display = 'none';
    answersEl.style.display = 'none';
    selectionInfoPanel.style.display = 'none';
    selectionPanel.style.display = 'flex';
    selectionTitle.textContent = title;
    selectionInfo.textContent = '';
    selectionButtons.innerHTML = '';
    selectionButtons.style.display = 'grid';

    if (!Array.isArray(items) || !items.length) {
      const p = document.createElement('p');
      p.textContent = 'Aucun élément disponible';
      p.style.color = '#ff6b6b';
      p.style.gridColumn = '1/-1';
      selectionButtons.appendChild(p);
      return;
    }

    items.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.className = 'selection-btn';
      btn.textContent = item.name || `Option ${idx + 1}`;
      if (selectedId && item.id === selectedId) {
        btn.classList.add('active');
      }
      selectionButtons.appendChild(btn);
    });
  }

  function showSelectionStep(step, message) {
    // Forcer l'affichage du panneau de sélection
    questionEl.style.display = 'none';
    answersEl.style.display = 'none';
    selectionInfoPanel.style.display = 'none';
    selectionPanel.style.display = 'flex';
    if (selectionButtons) selectionButtons.style.display = 'none';

    const titles = {
      start: 'Sélection en cours...',
      level: 'Choix de la difficulté',
      category: 'Choix de la catégorie',
      theme: 'Choix du thème',
      ready: 'Prêt à lancer'
    };

    selectionTitle.textContent = titles[step] || 'Sélection';
    selectionInfo.textContent = message || '';
    selectionInfo.style.fontSize = '28px';
    selectionInfo.style.fontWeight = '600';
    selectionInfo.style.color = '#9fb0d3';
    selectionInfo.style.textAlign = 'center';
    selectionInfo.style.marginTop = '12px';
  }

  function showThemeSelection(theme, level, category) {
    // Afficher le thème sélectionné
    selectionTitle.textContent = '🎨 Thème sélectionné';
    selectionInfo.innerHTML = `
      <div style="margin-bottom: 16px; font-size: 16px; color: #9fb0d3;">
        ${level?.name || ''} | ${category?.name || ''}
      </div>
      <div style="font-size: 36px; font-weight: 700; color: #42e8c4;">
        ${theme.name}
      </div>
    `;
    
    selectedTheme = theme;
    selectedLevel = level;
    selectedCategory = category;
  }

  async function loadQuestion(levelId, categoryId, themeId, level, category, theme) {
    // Afficher les infos de sélection si disponibles
    if (level && category && theme) {
      selectionInfoPanel.style.display = 'flex';
      infoLevel.textContent = level.name || '';
      infoCategory.textContent = category.name || '';
      infoTheme.textContent = theme.name || '';
    } else {
      selectionInfoPanel.style.display = 'none';
    }
    
    // Cacher le panneau de sélection
    selectionPanel.style.display = 'none';
    questionEl.style.display = 'block';
    answersEl.style.display = 'grid';
    
    const q = await fetchRandomQuestion(levelId, categoryId, themeId);
    displayQuestion(q);
  }

  function showLevelSelection(level) {
    // Cacher la question et les réponses
    questionEl.style.display = 'none';
    answersEl.style.display = 'none';
    selectionInfoPanel.style.display = 'none';
    
    // Afficher le panneau de sélection
    selectionPanel.style.display = 'flex';
    selectionTitle.textContent = '🎯 Difficulté sélectionnée';
    selectionInfo.textContent = level.name;
    selectionInfo.style.fontSize = '32px';
    selectionInfo.style.fontWeight = '700';
    selectionInfo.style.color = '#42e8c4';
    selectionInfo.style.textAlign = 'center';
    selectionInfo.style.marginTop = '20px';
    selectionButtons.innerHTML = '';
    selectionButtons.style.display = 'none';
    
    selectedLevel = level;
  }

  function showCategorySelection(category) {
    // Afficher la catégorie sélectionnée
    selectionTitle.textContent = '📂 Catégorie sélectionnée';
    selectionInfo.textContent = category.name;
    selectionInfo.style.fontSize = '32px';
    selectionInfo.style.fontWeight = '700';
    selectionInfo.style.color = '#7c5dff';
    
    selectedCategory = category;
  }

  function showThemeSelection(theme, level, category) {
    // Afficher le thème sélectionné
    selectionTitle.textContent = '🎨 Thème sélectionné';
    selectionInfo.innerHTML = `
      <div style="margin-bottom: 16px; font-size: 16px; color: #9fb0d3;">
        ${level?.name || ''} | ${category?.name || ''}
      </div>
      <div style="font-size: 36px; font-weight: 700; color: #42e8c4;">
        ${theme.name}
      </div>
    `;
    
    selectedTheme = theme;
    selectedLevel = level;
    selectedCategory = category;
  }

  function handleCommand(cmd) {
    if (!cmd || typeof cmd !== 'object') return;
    updateConnectionStatus(true);
    switch (cmd.type) {
      case 'START_SELECTION':
        showSelectionStep('start', 'Préparation de la sélection...');
        if (selectionButtons) {
          selectionButtons.innerHTML = '';
          selectionButtons.style.display = 'none';
        }
        break;

      case 'SELECTION_STEP':
        showSelectionStep(cmd.step, cmd.message);
        break;
      
      case 'SHOW_LEVEL':
        if (cmd.level) {
          showLevelSelection(cmd.level);
        }
        break;

      case 'SHOW_LEVELS_LIST':
        renderSelectionList('🎯 Choisissez la difficulté', cmd.levels || [], cmd.selectedId);
        break;
      
      case 'SHOW_CATEGORY':
        if (cmd.category) {
          showCategorySelection(cmd.category);
        }
        break;

      case 'SHOW_CATEGORIES_LIST':
        renderSelectionList('📂 Choisissez la catégorie', cmd.categories || [], cmd.selectedId);
        break;
      
      case 'SHOW_THEME':
        if (cmd.theme) {
          showThemeSelection(cmd.theme, cmd.level, cmd.category);
        }
        break;
      
      case 'LOAD_QUESTION':
        if (cmd.question) {
          loadQuestion(
            cmd.level?.id, 
            cmd.category?.id, 
            cmd.theme?.id,
            cmd.level,
            cmd.category,
            cmd.theme
          );
        }
        break;
      case 'REVEAL_ANSWER':
        revealAnswer();
        break;
      case 'RESTART_TIMER':
        timerDuration = cmd.duration || timerDuration || DEFAULT_DURATION;
        restartTimer(timerDuration);
        break;
      case 'HIGHLIGHT_ANSWER':
        highlightAnswer(cmd.index);
        break;
      case 'STATE_REQUEST':
        broadcastState();
        break;
      default:
        break;
    }
  }

  function broadcastState() {
    if (!currentQuestion) return;
    const payload = {
      question: currentQuestion,
      timer: timerDuration,
      selectedIndex
    };
    if (channel) {
      channel.postMessage({ type: 'STATE_UPDATE', ...payload });
    } else {
      localStorage.setItem('quiz-state', JSON.stringify({ type: 'STATE_UPDATE', ...payload }));
    }
    
    // Envoyer l'état au serveur pour que l'admin le récupère
    fetch('http://localhost:3000/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.warn('[OVERLAY] Erreur envoi état:', err.message));
    
    updateConnectionStatus(true);
  }

  // Init
  console.log('[OVERLAY] Démarrage de l\'overlay');
  initChannel();
  
  // Charger et afficher les niveaux au démarrage
  (async () => {
    try {
      const res = await fetch('http://localhost:3000/levels');
      const levels = await res.json();
      
      if (levels && levels.length > 0) {
        // Afficher le panneau de sélection
        questionEl.style.display = 'none';
        answersEl.style.display = 'none';
        selectionInfoPanel.style.display = 'none';
        selectionPanel.style.display = 'flex';
        selectionTitle.textContent = '🎯 Choisissez la difficulté';
        selectionInfo.textContent = '';
        selectionButtons.innerHTML = '';
        selectionButtons.style.display = 'grid';
        
        // Créer les boutons
        levels.forEach(level => {
          const btn = document.createElement('button');
          btn.className = 'selection-btn';
          btn.textContent = level.name;
          btn.addEventListener('click', () => {
            showLevelSelection(level);
          });
          selectionButtons.appendChild(btn);
        });
      }
    } catch (err) {
      console.error('[OVERLAY] Erreur chargement niveaux au démarrage:', err);
    }
  })();
})();
