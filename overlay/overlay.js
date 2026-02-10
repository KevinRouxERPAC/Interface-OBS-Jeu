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
    showScreen('selection');
    renderSelection(state.selectionState);
    return;
  }

  // Déterminer quel écran afficher
  showScreen(state.screen);

  // Mettre à jour le contenu selon l'écran
  switch (state.screen) {
    case 'question':
      if (currentScreen !== 'question') playSound('question');
      renderQuestion(state);
      break;
    case 'answer':
      if (!lastState || lastState.screen !== 'answer') playSound('selection');
      renderAnswer(state);
      break;
    case 'waiting':
    default:
      break;
  }
  lastState = state;
}

/**
 * Affiche chacune des 5 étapes de sélection sur l'overlay (options + sélection)
 */
function renderSelection(selectionState) {
  const container = document.getElementById('selection-steps');
  if (!container || !selectionState || !selectionState.steps) return;

  const stepOrder = ['matiere', 'level', 'category', 'theme', 'question'];
  const steps = selectionState.steps;

  container.innerHTML = stepOrder.map((stepId) => {
    const step = steps[stepId] || {};
    const label = step.label || stepId;
    const selected = step.selected;
    const options = step.options || [];
    const isCurrent = selectionState.currentStep === stepId;

    let content = '';
    if (selected) {
      content = `<div class="selection-step-value selected">${escapeHtml(selected)}</div>`;
    } else if (isCurrent && options.length) {
      content = `<div class="selection-step-options">${options.map((o) => `<span class="selection-option">${escapeHtml(o.label)}</span>`).join('')}</div>`;
    } else if (isCurrent && (stepId === 'theme' || stepId === 'question')) {
      content = `<div class="selection-step-draw">Tirage au sort...</div>`;
    } else {
      content = `<span class="selection-step-wait">—</span>`;
    }

    return `
      <div class="selection-step ${isCurrent ? 'current' : ''} ${selected ? 'done' : ''}">
        <div class="selection-step-label">${escapeHtml(label)}</div>
        ${content}
      </div>
    `;
  }).join('');
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
// - selection.mp3 : quand le streamer sélectionne une réponse (révélation)
// - good.mp3 : bonne réponse
// - bad.mp3 : mauvaise réponse
function playSound(name) {
  try {
    const audio = new Audio(`/overlay/assets/sounds/${name}.mp3`);
    audio.volume = 0.8;
    audio.play().catch(() => {});
  } catch (_) {}
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
