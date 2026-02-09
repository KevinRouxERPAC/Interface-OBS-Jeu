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

// ─── DOM Elements ───────────────────────────────────────────
const screens = {
  waiting: document.getElementById('screen-waiting'),
  question: document.getElementById('screen-question'),
  answer: document.getElementById('screen-answer'),
  scores: document.getElementById('screen-scores'),
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

  // Déterminer quel écran afficher
  showScreen(state.screen);

  // Mettre à jour le contenu selon l'écran
  switch (state.screen) {
    case 'question':
      renderQuestion(state);
      break;
    case 'answer':
      renderAnswer(state);
      break;
    case 'scores':
      renderScores(state);
      break;
    case 'waiting':
    default:
      break;
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

  // Propositions
  const propEl = document.getElementById('q-propositions');
  propEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  q.propositions.forEach((prop, i) => {
    const div = document.createElement('div');
    div.className = 'proposition';
    div.innerHTML = `<span class="letter">${letters[i]}</span>${escapeHtml(prop)}`;
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

  // Propositions with result coloring
  const propEl = document.getElementById('a-propositions');
  propEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  q.propositions.forEach((prop, i) => {
    const div = document.createElement('div');
    div.className = 'proposition';
    div.innerHTML = `<span class="letter">${letters[i]}</span>${escapeHtml(prop)}`;

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

  // Result banner
  const resultEl = document.getElementById('a-result');
  if (state.state === 'answer_validated') {
    resultEl.classList.remove('hidden', 'correct', 'incorrect');
    if (state.isCorrect) {
      resultEl.classList.add('correct');
      resultEl.textContent = 'Bonne réponse !';
    } else {
      resultEl.classList.add('incorrect');
      resultEl.textContent = 'Mauvaise réponse !';
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

function renderScores(state) {
  const board = document.getElementById('scores-board');
  const scores = state.scores;

  if (!scores || Object.keys(scores).length === 0) {
    board.innerHTML = '<div class="scores-empty">Aucun score</div>';
    return;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  board.innerHTML = sorted.map(([name, score], index) => `
    <div class="score-row" style="animation-delay: ${index * 0.1}s">
      <span class="score-rank">#${index + 1}</span>
      <span class="score-name">${escapeHtml(name)}</span>
      <span class="score-value">${score}</span>
    </div>
  `).join('');
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

socket.on('game:score-updated', (state) => {
  updateOverlay(state);
});

socket.on('game:reset', (state) => {
  updateOverlay(state);
});
