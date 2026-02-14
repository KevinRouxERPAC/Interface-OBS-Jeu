/**
 * Overlay - Logique front-end pour l'affichage dans OBS
 * Écoute uniquement les WebSocket pour recevoir les mises à jour.
 */

// ─── Connexion Socket.IO ────────────────────────────────────
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

// ─── State ──────────────────────────────────────────────────
let currentScreen = 'waiting';
let lastState = null;
let selectionAudio = null; // son de sélection (joué en boucle jusqu'à révélation)

// ─── DOM Elements ───────────────────────────────────────────
const screens = {
  waiting: document.getElementById('screen-waiting'),
  selection: document.getElementById('screen-selection'),
  question: document.getElementById('screen-question'),
  answer: document.getElementById('screen-answer'),
};

// ─── Screen Management ──────────────────────────────────────
function showScreen(screenName) {
  if (currentScreen === screenName) return;

  Object.entries(screens).forEach(([name, el]) => {
    if (name === screenName) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  currentScreen = screenName;
}

// ─── Update Functions ───────────────────────────────────────
function updateOverlay(state) {
  if (!state) return;

  // Écran sélection : affiché quand selectionState est présent (chaque étape visible pour les viewers)
  if (state.selectionState) {
    stopSelectionSound();
    showScreen('selection');
    renderSelection(state.selectionState);
    return;
  }

  // Déterminer quel écran afficher
  const wasOnAnswer = currentScreen === 'answer';
  showScreen(state.screen);

  // Son de sélection : jouer en boucle quand le streamer a sélectionné une réponse (A/B/C/D), arrêter en quittant l'écran
  if (state.screen === 'answer') {
    if (!wasOnAnswer && state.state === 'answer_validated') {
      stopSelectionSound();
      startSelectionSoundLoop();
    }
  } else {
    stopSelectionSound();
  }

  // Mettre à jour le contenu selon l'écran
  switch (state.screen) {
    case 'question':
      if (currentScreen !== 'question') playSound('question');
      renderQuestion(state);
      break;
    case 'answer':
      renderAnswer(state);
      break;
    case 'waiting':
    default:
      break;
  }
  lastState = state;
}

/**
 * Affiche l'écran de sélection adapté à l'étape courante (style bandeau TV)
 * Étape 1-3 : bandeau avec titre + boutons options
 * Étape 4 : thème sélectionné en gros avec fade-in
 */
function renderSelection(selectionState) {
  const container = document.getElementById('selection-steps');
  const titleEl = document.getElementById('selection-title');
  const summaryEl = document.getElementById('selection-summary');
  if (!container || !selectionState || !selectionState.steps) return;

  const currentStep = selectionState.currentStep;
  const steps = selectionState.steps;
  const step = steps[currentStep] || {};
  const options = step.options || [];
  const selected = step.selected;

  // Afficher les sélections déjà faites (pour spectateurs et participants)
  const summaryLabels = { matiere: 'Matière', level: 'Difficulté', category: 'Catégorie', theme: 'Thème' };
  const summaryParts = [];
  ['matiere', 'level', 'category', 'theme'].forEach((stepId) => {
    const s = steps[stepId]?.selected;
    if (s) summaryParts.push(`${summaryLabels[stepId]} : ${s}`);
  });
  if (summaryParts.length > 0) {
    summaryEl.innerHTML = `<div class="selection-summary-label">Sélections faites</div><div class="selection-summary-text">${summaryParts.map(p => escapeHtml(p)).join('  •  ')}</div>`;
    summaryEl.classList.remove('hidden');
  } else {
    summaryEl.innerHTML = '';
    summaryEl.classList.add('hidden');
  }

  const stepTitles = {
    matiere: 'Choisis la matière',
    level: 'Choisis la difficulté',
    category: 'Choisis la catégorie',
    theme: 'Thème sélectionné',
    question: 'Tirage de la question...',
  };
  titleEl.textContent = stepTitles[currentStep] || step.label || currentStep;

  // Étape 4 (thème) ou 5 (question) avec thème sélectionné : afficher le thème en gros
  const themeSelected = steps.theme?.selected;
  if (themeSelected && (currentStep === 'theme' || currentStep === 'question')) {
    const drawHint = currentStep === 'question' ? '<div class="selection-theme-hint">Tirage de la question…</div>' : '';
    container.innerHTML = `
      <div class="selection-theme-reveal">
        <div class="selection-theme-value">${escapeHtml(themeSelected)}</div>
        ${drawHint}
      </div>
    `;
    container.classList.add('theme-reveal');
    return;
  }

  // Étape 5 sans thème (cas limite) : tirage en cours
  if (currentStep === 'question') {
    container.innerHTML = `
      <div class="selection-draw-pending">
        <span class="selection-draw-icon">?</span>
        <span>Tirage au sort en cours...</span>
      </div>
    `;
    container.classList.remove('theme-reveal');
    return;
  }

  container.classList.remove('theme-reveal');

  // Étapes 1-3 : bandeau avec boutons
  if (options.length > 0) {
    container.innerHTML = `
      <div class="selection-step-options selection-options-buttons">
        ${options.map((o) => `<span class="selection-option">${escapeHtml(o.label)}</span>`).join('')}
      </div>
    `;
  } else {
    container.innerHTML = `<div class="selection-step-wait">—</div>`;
  }
}

function renderQuestion(state) {
  const q = state.currentQuestion;
  if (!q) return;

  // Counter
  document.getElementById('q-counter').textContent = `Question ${state.questionCount}`;

  // Tags
  const tagsEl = document.getElementById('q-tags');
  tagsEl.innerHTML = '';
  if (q.themeName) tagsEl.innerHTML += `<span class="tag">${escapeHtml(q.themeName)}</span>`;
  if (q.levelName) tagsEl.innerHTML += `<span class="tag">${escapeHtml(q.levelName)}</span>`;

  // Question text
  document.getElementById('q-text').textContent = q.question;

  // Propositions (style jeu TV : A B C D)
  const propEl = document.getElementById('q-propositions');
  propEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  q.propositions.forEach((prop, i) => {
    const div = document.createElement('div');
    div.className = 'answer-box';
    div.innerHTML = `<span class="letter">${letters[i]}</span><span class="answer-text">${escapeHtml(prop)}</span>`;
    propEl.appendChild(div);
  });
}

function renderAnswer(state) {
  const q = state.currentQuestion;
  if (!q) return;

  // Counter
  document.getElementById('a-counter').textContent = `Question ${state.questionCount}`;

  // Question text
  document.getElementById('a-text').textContent = q.question;

  // Propositions avec révélation (style jeu TV)
  const propEl = document.getElementById('a-propositions');
  propEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  q.propositions.forEach((prop, i) => {
    const div = document.createElement('div');
    div.className = 'answer-box';
    div.innerHTML = `<span class="letter">${letters[i]}</span><span class="answer-text">${escapeHtml(prop)}</span>`;

    if (state.state === 'answer_validated') {
      if (prop === q.rightAnswer) {
        div.classList.add('reveal-correct');
      } else if (state.selectedAnswer === i) {
        div.classList.add('reveal-incorrect', 'selected');
      } else {
        div.classList.add('dimmed');
      }
    } else if (state.state === 'answer_revealed') {
      if (prop === q.rightAnswer) {
        div.classList.add('reveal-correct');
      } else {
        div.classList.add('dimmed');
      }
    }

    propEl.appendChild(div);
  });

  // Result banner (son bonne/mauvaise réponse une seule fois à la validation)
  const resultEl = document.getElementById('a-result');
  if (state.state === 'answer_validated') {
    const justValidated = !lastState || lastState.state !== 'answer_validated';
    resultEl.classList.remove('hidden', 'correct', 'incorrect');
    if (state.isCorrect) {
      resultEl.classList.add('correct');
      resultEl.textContent = 'Bonne réponse !';
      if (justValidated) playSound('good');
    } else {
      resultEl.classList.add('incorrect');
      resultEl.textContent = 'Mauvaise réponse !';
      if (justValidated) playSound('bad');
    }
  } else {
    resultEl.classList.add('hidden');
  }

  // Explanation
  const explEl = document.getElementById('a-explanation');
  if (q.explications && (state.state === 'answer_validated' || state.state === 'answer_revealed')) {
    explEl.textContent = q.explications;
    explEl.classList.remove('hidden');
  } else {
    explEl.classList.add('hidden');
  }
}

// ─── Sons (à remplir avec tes fichiers dans overlay/assets/sounds/) ───
// Fichiers attendus :
// - question.mp3 : quand la question s'affiche à l'écran
// - selection.mp3 : joué en boucle dès la sélection d'une réponse, jusqu'à ce qu'on quitte l'écran réponse
// - good.mp3 : bonne réponse
// - bad.mp3 : mauvaise réponse
function playSound(name) {
  try {
    const audio = new Audio(`/overlay/assets/sounds/${name}.mp3`);
    audio.volume = 0.8;
    audio.play().catch(() => {});
  } catch (_) {}
}

function startSelectionSoundLoop() {
  try {
    stopSelectionSound();
    selectionAudio = new Audio('/overlay/assets/sounds/selection.mp3');
    selectionAudio.volume = 0.8;
    selectionAudio.loop = true;
    selectionAudio.play().catch(() => {});
  } catch (_) {}
}

function stopSelectionSound() {
  if (selectionAudio) {
    try {
      selectionAudio.pause();
      selectionAudio.currentTime = 0;
    } catch (_) {}
    selectionAudio = null;
  }
}

// ─── Helpers ────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Socket Events ──────────────────────────────────────────
socket.on('connect', () => {
  console.log('[Overlay] Connecté au serveur');
  socket.emit('request:state');
});

socket.on('disconnect', () => {
  console.log('[Overlay] Déconnecté');
});

socket.on('game:state-update', (state) => {
  updateOverlay(state);
});

socket.on('game:question-selected', (state) => {
  updateOverlay(state);
});

socket.on('game:answer-revealed', (state) => {
  updateOverlay(state);
});

socket.on('game:answer-validated', (state) => {
  updateOverlay(state);
});

socket.on('game:screen-changed', (state) => {
  updateOverlay(state);
});

socket.on('game:reset', (state) => {
  updateOverlay(state);
});

socket.on('game:selection-step', (state) => {
  updateOverlay(state);
});
