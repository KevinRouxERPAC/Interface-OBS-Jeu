(() => {
  const channelName = 'quiz-control';
  const API_URL = 'http://localhost:3000';
  const API_KEY = localStorage.getItem('quiz-api-key') || ''; // Clé API optionnelle
  
  const btnStartSelection = document.getElementById('btn-start-selection');
  const btnLaunchQuestion = document.getElementById('btn-launch-question');
  const btnReveal = document.getElementById('btn-reveal');
  const btnTimer = document.getElementById('btn-timer');
  const qText = document.getElementById('q-text');
  const qAnswers = document.getElementById('q-answers');
  const qExplication = document.getElementById('q-explication');
  const statusEl = document.getElementById('status');
  const selectButtons = Array.from(document.querySelectorAll('.select-btn'));
  const syncIndicator = document.getElementById('sync-indicator');
  const syncText = syncIndicator?.querySelector('.sync-text');

  let channel = null;
  let lastStateId = 0;
  let selectedLevel = null;
  let selectedCategory = null;
  let selectedTheme = null;
  let currentStep = 'idle'; // idle, level, category, theme, ready
  
  const stepLevel = document.getElementById('step-level');
  const stepCategory = document.getElementById('step-category');
  const stepTheme = document.getElementById('step-theme');
  const levelsGrid = document.getElementById('levels-grid');
  const categoriesGrid = document.getElementById('categories-grid');
  const themeDisplay = document.getElementById('theme-display');

  // Fonction utilitaire pour envoyer des requêtes avec la clé API
  function fetchWithApiKey(url, options = {}) {
    const headers = { ...options.headers };
    if (API_KEY) {
      headers['X-API-Key'] = API_KEY;
    }
    return fetch(url, { ...options, headers });
  }

  function initChannel() {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(channelName);
      channel.onmessage = (event) => handleMessage(event.data);
    }
    window.addEventListener('storage', (event) => {
      if (event.key === 'quiz-state' && event.newValue) {
        try {
          const state = JSON.parse(event.newValue);
          handleMessage(state);
        } catch (err) {
          console.error('State storage invalide', err);
        }
      }
    });
    // Ask overlay for its current state
    sendCommand({ type: 'STATE_REQUEST' });

    // Poll serveur pour récupérer l'état de l'overlay (pour OBS)
    console.log('[ADMIN] Démarrage du polling d\'état');
    setInterval(async () => {
      try {
        const res = await fetchWithApiKey(`${API_URL}/state`);
        if (!res.ok) return;
        const state = await res.json();
        if (!state || !state.question) return;
        // Vérifier qu'on a un nouvel état
        if (state.timestamp && state.timestamp <= lastStateId) return;
        
        lastStateId = state.timestamp;
        console.log('[ADMIN] État reçu du serveur:', state);
        handleMessage({ type: 'STATE_UPDATE', ...state });
      } catch (err) {
        // Silencieux
      }
    }, 1000);
  }

  function sendCommand(cmd) {
    console.log('[ADMIN] Envoi commande:', cmd);
    
    // Envoi via serveur (PRINCIPAL pour OBS)
    fetchWithApiKey(`${API_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd)
    })
      .then(res => res.json())
      .then(data => console.log('[ADMIN] Commande envoyée, ID:', data.id))
      .catch(err => console.error('[ADMIN] Erreur envoi:', err));

    if (syncIndicator) {
      syncIndicator.classList.remove('synced');
      syncIndicator.classList.add('waiting');
      if (syncText) syncText.textContent = 'Envoi...';
    }

    if (channel) {
      channel.postMessage(cmd);
    } else {
      localStorage.setItem('quiz-command', JSON.stringify(cmd));
    }
  }

  function handleMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'STATE_UPDATE' && message.question) {
      renderState(message.question, message.timer, message.selectedIndex);
      statusEl.textContent = 'Synchronisé avec l\'overlay';
      if (syncIndicator) {
        syncIndicator.classList.remove('waiting');
        syncIndicator.classList.add('synced');
        if (syncText) syncText.textContent = 'Synchronisé';
      }
    }
    if (message.type === 'ANSWER_REVEALED') {
      statusEl.textContent = 'Réponse révélée';
    }
    if (message.type === 'TIMER_END') {
      statusEl.textContent = 'Timer terminé';
    }
  }

  function renderState(question, timer, selectedIndex) {
    qText.textContent = question.question;
    qAnswers.innerHTML = '';
    (question.propositions || []).forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'answer';
      div.textContent = `${String.fromCharCode(65 + idx)}. ${p}`;
      qAnswers.appendChild(div);
    });
    
    // Afficher l'explication si disponible
    if (question.explication) {
      qExplication.style.display = 'block';
      qExplication.textContent = `💡 ${question.explication}`;
    } else {
      qExplication.style.display = 'none';
    }
    
    updateSelectUI(selectedIndex);
  }

  function updateSelectUI(selectedIndex) {
    selectButtons.forEach((btn) => {
      const idx = Number(btn.dataset.index);
      btn.classList.toggle('active', selectedIndex === idx);
    });
  }

  async function startSelection() {
    // Réinitialiser
    selectedLevel = null;
    selectedCategory = null;
    selectedTheme = null;
    currentStep = 'level';
    
    // Afficher l'étape 1
    stepLevel.style.display = 'block';
    stepCategory.style.display = 'none';
    stepTheme.style.display = 'none';
    btnLaunchQuestion.style.display = 'none';
    
    // Charger les niveaux
    try {
      const res = await fetch('http://localhost:3000/levels');
      const levels = await res.json();
      levelsGrid.innerHTML = '';
      levels.forEach(level => {
        const btn = document.createElement('button');
        btn.className = 'select-btn';
        btn.textContent = level.name;
        btn.addEventListener('click', () => selectLevel(level));
        levelsGrid.appendChild(btn);
      });
      statusEl.textContent = 'Sélectionnez une difficulté';
      
      // Envoyer commande à l'overlay pour préparer l'affichage
      sendCommand({ type: 'START_SELECTION' });
    } catch (err) {
      console.error('[ADMIN] Erreur chargement niveaux:', err);
      levelsGrid.innerHTML = '<p style="grid-column: 1/-1; margin: 0; color: #ff6b6b;">Erreur chargement</p>';
      statusEl.textContent = '❌ Erreur lors du chargement des difficultés';
    }
  }

  async function selectLevel(level) {
    selectedLevel = level;
    currentStep = 'category';
    statusEl.textContent = `🎯 Difficulté sélectionnée : ${level.name}`;
    
    // Marquer le bouton sélectionné
    Array.from(levelsGrid.children).forEach(btn => {
      btn.classList.toggle('active', btn.textContent === level.name);
    });
    
    // Envoyer à l'overlay pour affichage 3 secondes
    sendCommand({ 
      type: 'SHOW_LEVEL',
      level: level
    });
    
    // Charger les catégories immédiatement
    try {
      const res = await fetch('http://localhost:3000/categories');
      const categories = await res.json();
      
      // Afficher l'étape 2 après 3 secondes
      setTimeout(() => {
        stepCategory.style.display = 'block';
        categoriesGrid.innerHTML = '';
        categories.forEach(category => {
          const btn = document.createElement('button');
          btn.className = 'select-btn';
          btn.textContent = category.name;
          btn.addEventListener('click', () => selectCategory(category));
          categoriesGrid.appendChild(btn);
        });
        statusEl.textContent = `${level.name} - Sélectionnez une catégorie`;
      }, 3000);
    } catch (err) {
      console.error('[ADMIN] Erreur chargement catégories:', err);
      setTimeout(() => {
        stepCategory.style.display = 'block';
        categoriesGrid.innerHTML = '<p style="grid-column: 1/-1; margin: 0; color: #ff6b6b;">Erreur chargement</p>';
        statusEl.textContent = '❌ Erreur lors du chargement des catégories';
      }, 3000);
    }
  }

  async function selectCategory(category) {
    selectedCategory = category;
    currentStep = 'theme';
    statusEl.textContent = `📂 Catégorie sélectionnée : ${category.name}`;
    
    // Marquer le bouton sélectionné
    Array.from(categoriesGrid.children).forEach(btn => {
      btn.classList.toggle('active', btn.textContent === category.name);
    });
    
    // Envoyer à l'overlay pour affichage 3 secondes
    sendCommand({ 
      type: 'SHOW_CATEGORY',
      category: category
    });
    
    // Charger et sélectionner un thème aléatoire
    try {
      const res = await fetch(`http://localhost:3000/themes?categoryId=${category.id}`);
      const themes = await res.json();
      
      if (themes.length === 0) {
        throw new Error('Aucun thème disponible');
      }
      
      // Sélectionner un thème aléatoire
      selectedTheme = themes[Math.floor(Math.random() * themes.length)];
      
      // Afficher le thème après 3 secondes
      setTimeout(() => {
        stepTheme.style.display = 'block';
        themeDisplay.textContent = `🎨 ${selectedTheme.name}`;
        themeDisplay.style.color = '#42e8c4';
        statusEl.textContent = `🎨 Thème sélectionné : ${selectedTheme.name}`;
        
        // Envoyer le thème à l'overlay
        sendCommand({ 
          type: 'SHOW_THEME',
          theme: selectedTheme,
          level: selectedLevel,
          category: selectedCategory
        });
        
        // Afficher le bouton de lancement après le thème
        setTimeout(() => {
          currentStep = 'ready';
          btnLaunchQuestion.style.display = 'inline-block';
          statusEl.textContent = '✅ Prêt ! Cliquez sur "Lancer la question"';
        }, 3000);
      }, 3000);
      
    } catch (err) {
      console.error('[ADMIN] Erreur chargement thèmes:', err);
      setTimeout(() => {
        stepTheme.style.display = 'block';
        themeDisplay.textContent = '❌ Erreur lors du chargement du thème';
        themeDisplay.style.color = '#ff6b6b';
        statusEl.textContent = '❌ Erreur lors du chargement du thème';
      }, 3000);
    }
  }

  async function launchQuestion() {
    if (!selectedLevel || !selectedCategory || !selectedTheme) {
      statusEl.textContent = '⚠️ Sélection incomplète';
      return;
    }
    
    statusEl.textContent = 'Chargement de la question...';
    
    try {
      const res = await fetch(`http://localhost:3000/random?levelId=${selectedLevel.id}&categoryId=${selectedCategory.id}&themeId=${selectedTheme.id}`);
      const question = await res.json();
      
      if (question && question.question) {
        sendCommand({ 
          type: 'LOAD_QUESTION',
          question: question,
          level: selectedLevel,
          category: selectedCategory,
          theme: selectedTheme
        });
        statusEl.textContent = `Question chargée: ${question.question.substring(0, 40)}...`;
        
        // Masquer le bouton de lancement
        btnLaunchQuestion.style.display = 'none';
        
        // Réinitialiser pour la prochaine question
        currentStep = 'idle';
      } else {
        throw new Error('Question invalide');
      }
    } catch (err) {
      console.error('[ADMIN] Erreur chargement question:', err);
      statusEl.textContent = '❌ Erreur lors du chargement de la question';
    }
  }

  btnStartSelection.addEventListener('click', () => {
    startSelection();
  });

  btnLaunchQuestion.addEventListener('click', () => {
    launchQuestion();
  });

  btnReveal.addEventListener('click', () => {
    const selectedAnswerIdx = selectButtons.findIndex(btn => btn.classList.contains('active'));
    if (selectedAnswerIdx === -1) {
      statusEl.textContent = '⚠️ Aucune réponse sélectionnée. Sélectionnez une réponse avant de révéler.';
      return;
    }
    sendCommand({ type: 'REVEAL_ANSWER' });
    statusEl.textContent = 'Révélation demandée';
  });

  btnTimer.addEventListener('click', () => {
    sendCommand({ type: 'RESTART_TIMER', duration: 30 });
    statusEl.textContent = 'Timer relancé';
  });

  selectButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      sendCommand({ type: 'HIGHLIGHT_ANSWER', index: idx });
      updateSelectUI(idx);
      statusEl.textContent = `Réponse ${btn.textContent} préselectionnée`;
    });
  });

  // Ne pas charger automatiquement, attendre que l'utilisateur clique sur "Démarrer la sélection"
  
  initChannel();
})();
