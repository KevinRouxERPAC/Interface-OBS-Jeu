/**
 * Admin Interface - Logique front-end
 * Gère les interactions utilisateur et la communication avec le backend.
 */

// ─── Connexion Socket.IO ────────────────────────────────────
const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });

// ─── State ──────────────────────────────────────────────────
let gameState = null;
let allQuestions = [];
let allThemes = [];
let allCategories = [];
let allLevels = [];
let allMatieres = [];

// ─── DOM Elements ───────────────────────────────────────────
const wsStatus = document.getElementById('ws-status');
const gsStatus = document.getElementById('gs-status');
const btnRefresh = document.getElementById('btn-refresh-data');
const btnReveal = document.getElementById('btn-reveal');
const btnNext = document.getElementById('btn-next');
const btnReset = document.getElementById('btn-reset');
const btnRandom = document.getElementById('btn-random');
const currentQuestionDisplay = document.getElementById('current-question-display');
const cqText = document.getElementById('cq-text');
const cqMeta = document.getElementById('cq-meta');
const cqPropositions = document.getElementById('cq-propositions');
const cqExplanation = document.getElementById('cq-explanation');
const questionList = document.getElementById('question-list');
const filterMatiere = document.getElementById('filter-matiere');
const filterCategory = document.getElementById('filter-category');
const filterTheme = document.getElementById('filter-theme');
const filterLevel = document.getElementById('filter-level');
const guidedStepsEl = document.getElementById('guided-steps');
const guidedStartEl = document.getElementById('guided-start');
const guidedWorkflowEl = document.getElementById('guided-workflow');
const btnStartWorkflow = document.getElementById('btn-start-workflow');
const btnResetWorkflow = document.getElementById('btn-reset-workflow');
const guidedHistoryEl = document.getElementById('guided-history');

// ─── Toast ──────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── API Calls ──────────────────────────────────────────────
async function apiCall(url, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Erreur inconnue', 'error');
    }
    return data;
  } catch (err) {
    showToast(`Erreur réseau: ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

// ─── Load Data ──────────────────────────────────────────────
async function loadAllData() {
  const [qRes, tRes, cRes, lRes, mRes, statusRes] = await Promise.all([
    apiCall('/api/data/questions'),
    apiCall('/api/data/themes'),
    apiCall('/api/data/categories'),
    apiCall('/api/data/levels'),
    apiCall('/api/data/matieres'),
    apiCall('/api/data/status'),
  ]);

  if (qRes.success) allQuestions = qRes.data;
  if (tRes.success) allThemes = tRes.data;
  if (cRes.success) allCategories = cRes.data;
  if (lRes.success) allLevels = lRes.data;
  if (mRes.success) allMatieres = mRes.data;

  // Mettre à jour le statut Google Sheets
  if (statusRes.success) {
    updateGSStatus(statusRes.data.googleSheets);
  }

  populateFilters();
  renderQuestionList();
  updateStats();
}

// ─── Update UI ──────────────────────────────────────────────
function updateGameUI(state) {
  gameState = state;

  // Stats
  updateStats();

  // Boutons
  const s = state.state;
  btnReveal.disabled = s !== 'question_displayed';
  btnNext.disabled = s !== 'answer_validated';

  // Current Question
  if (state.currentQuestion) {
    currentQuestionDisplay.classList.remove('hidden');
    cqText.textContent = state.currentQuestion.question;

    // Meta tags
    cqMeta.innerHTML = '';
    if (state.currentQuestion.themeName) {
      cqMeta.innerHTML += `<span class="tag">${state.currentQuestion.themeName}</span>`;
    }
    if (state.currentQuestion.levelName) {
      cqMeta.innerHTML += `<span class="tag">${state.currentQuestion.levelName}</span>`;
    }
    if (state.currentQuestion.categoryName) {
      cqMeta.innerHTML += `<span class="tag">${state.currentQuestion.categoryName}</span>`;
    }

    // Propositions
    renderPropositions(state);

    // Explanation
    if ((s === 'answer_validated' || s === 'answer_revealed') && state.currentQuestion.explications) {
      cqExplanation.textContent = state.currentQuestion.explications;
      cqExplanation.classList.remove('hidden');
    } else {
      cqExplanation.classList.add('hidden');
    }
  } else {
    currentQuestionDisplay.classList.add('hidden');
  }

  // Marquer les questions posées dans la liste
  renderQuestionList();

  // Sélection guidée (affichée sur l'overlay)
  updateGuidedWorkflowUI(state.selectionState);
}

function renderPropositions(state) {
  cqPropositions.innerHTML = '';
  const q = state.currentQuestion;
  if (!q || !q.propositions) return;

  q.propositions.forEach((prop, index) => {
    const btn = document.createElement('button');
    btn.className = 'proposition-btn';
    btn.textContent = prop;

    // Coloration selon l'état
    if (state.state === 'answer_validated' || state.state === 'answer_revealed') {
      if (prop === q.rightAnswer) {
        btn.classList.add('correct');
      }
      if (state.selectedAnswer === index && !state.isCorrect) {
        btn.classList.add('incorrect');
      }
      if (state.selectedAnswer === index) {
        btn.classList.add('selected');
      }
    } else {
      // En mode question_displayed, cliquer valide la réponse
      btn.addEventListener('click', () => validateAnswer(index));
    }

    cqPropositions.appendChild(btn);
  });
}

function updateStats() {
  document.getElementById('stat-questions').textContent = allQuestions.length;
  document.getElementById('stat-themes').textContent = allThemes.length;
  document.getElementById('stat-asked').textContent = gameState ? gameState.questionHistory.length : 0;

  const stateLabels = {
    waiting: 'Attente',
    question_displayed: 'Question',
    answer_revealed: 'Réponse révélée',
    answer_validated: 'Réponse validée',
    scoreboard: 'Scores',
  };
  document.getElementById('stat-state').textContent = gameState ? (stateLabels[gameState.state] || gameState.state) : 'Attente';
}

function updateGSStatus(gs) {
  if (gs.status === 'connected') {
    gsStatus.className = 'status-badge connected';
  } else if (gs.lastError) {
    gsStatus.className = 'status-badge disconnected';
  } else {
    gsStatus.className = 'status-badge cached';
  }
}

// ─── Sélection guidée (5 étapes, visibles sur l'overlay) ─────
function updateGuidedWorkflowUI(selectionState) {
  if (!selectionState) {
    guidedStartEl?.classList.remove('hidden');
    guidedWorkflowEl?.classList.add('hidden');
    return;
  }
  guidedStartEl?.classList.add('hidden');
  guidedWorkflowEl?.classList.remove('hidden');

  // Historique : matière → difficulté → catégorie → thème → question
  const steps = selectionState.steps || {};
  const parts = [];
  if (steps.matiere?.selected) parts.push(steps.matiere.selected);
  if (steps.level?.selected) parts.push(steps.level.selected);
  if (steps.category?.selected) parts.push(steps.category.selected);
  if (steps.theme?.selected) parts.push(steps.theme.selected);
  if (steps.question?.selected) parts.push('Question sélectionnée');
  guidedHistoryEl.textContent = parts.length ? parts.join(' › ') : '—';
  guidedHistoryEl.title = parts.length ? parts.join(' → ') : '';

  renderGuidedSteps(selectionState);
}

function renderGuidedSteps(selectionState) {
  const stepOrder = ['matiere', 'level', 'category', 'theme', 'question'];
  const currentStep = selectionState?.currentStep || 'matiere';
  const steps = selectionState?.steps || {};

  const matiereOptions = steps.matiere?.options?.length
    ? steps.matiere.options
    : allMatieres.map(m => ({ value: m.Nom, label: m.Nom }));

  let html = '';
  stepOrder.forEach((stepId) => {
    const step = steps[stepId] || {};
    const label = step.label || stepId;
    const selected = step.selected;
    const options = step.options || (stepId === 'matiere' ? matiereOptions : []);
    const isCurrent = currentStep === stepId;

    html += `<div class="guided-step ${isCurrent ? 'current' : ''} ${selected ? 'done' : ''}" data-step="${stepId}">`;
    html += `<div class="guided-step-label">${escapeHtml(label)}</div>`;

    if (selected) {
      html += `<div class="guided-step-selected">${escapeHtml(selected)}</div>`;
    } else if (isCurrent && options.length) {
      html += '<div class="guided-step-options">';
      options.forEach((opt) => {
        html += `<button type="button" class="btn btn-step-option" data-step="${stepId}" data-value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</button>`;
      });
      html += '</div>';
    } else if (isCurrent && (stepId === 'theme' || stepId === 'question')) {
      const btnLabel = stepId === 'theme' ? 'Tirer le thème au sort' : 'Tirer la question au sort';
      html += `<button type="button" class="btn btn-primary btn-draw" data-step="${stepId}">${btnLabel}</button>`;
    } else if (!selected) {
      html += '<span class="guided-step-wait">—</span>';
    }
    html += '</div>';
  });

  guidedStepsEl.innerHTML = html;

  guidedStepsEl.querySelectorAll('.btn-step-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      const value = btn.dataset.value;
      postSelectionStep(step, value);
    });
  });
  guidedStepsEl.querySelectorAll('.btn-draw').forEach((btn) => {
    btn.addEventListener('click', () => {
      postSelectionStep(btn.dataset.step);
    });
  });
}

async function startOrResetWorkflow() {
  const res = await apiCall('/api/game/reset-workflow', 'POST');
  if (res.success) {
    updateGameUI(res.data);
    showToast('Sélection guidée démarrée', 'success');
  }
}

async function postSelectionStep(step, selected) {
  const body = { step };
  if (selected !== undefined) body.selected = selected;
  const res = await apiCall('/api/game/selection-step', 'POST', body);
  if (res.success && res.data) {
    updateGameUI(res.data);
    if (step === 'question') showToast('Question sélectionnée', 'success');
    else if (step === 'theme') showToast('Thème tiré au sort', 'success');
  }
}

// ─── Filters & Question List ────────────────────────────────
function populateFilters() {
  // Matières
  filterMatiere.innerHTML = '<option value="">Toutes les matières</option>';
  allMatieres.forEach(m => {
    filterMatiere.innerHTML += `<option value="${escapeHtml(m.Nom)}">${escapeHtml(m.Nom)}</option>`;
  });

  // Catégories
  filterCategory.innerHTML = '<option value="">Toutes les catégories</option>';
  allCategories.forEach(c => {
    filterCategory.innerHTML += `<option value="${escapeHtml(c.Name)}">${escapeHtml(c.Name)}</option>`;
  });

  // Thèmes
  filterTheme.innerHTML = '<option value="">Tous les thèmes</option>';
  allThemes.forEach(t => {
    filterTheme.innerHTML += `<option value="${t.ID}">${escapeHtml(t.Name)}</option>`;
  });

  // Niveaux
  filterLevel.innerHTML = '<option value="">Tous les niveaux</option>';
  allLevels.forEach(l => {
    filterLevel.innerHTML += `<option value="${escapeHtml(l.Libel)}">${escapeHtml(l.Libel)}</option>`;
  });
}

function getFilteredQuestions() {
  let questions = [...allQuestions];

  const matiere = filterMatiere.value;
  const category = filterCategory.value;
  const theme = filterTheme.value;
  const level = filterLevel.value;

  if (matiere) questions = questions.filter(q => q.matiereName === matiere);
  if (category) questions = questions.filter(q => q.categoryName === category);
  if (theme) questions = questions.filter(q => q.IDTheme === parseInt(theme, 10));
  if (level) questions = questions.filter(q => q.levelName === level);

  return questions;
}

function renderQuestionList() {
  const questions = getFilteredQuestions();

  if (questions.length === 0) {
    questionList.innerHTML = '<p class="empty-state">Aucune question disponible</p>';
    return;
  }

  const askedIds = gameState ? gameState.questionHistory : [];

  questionList.innerHTML = questions.map(q => {
    const isAsked = askedIds.includes(q.ID);
    return `<div class="question-item ${isAsked ? 'asked' : ''}" data-id="${q.ID}">
      <span class="q-text">${escapeHtml(q.Question)}</span>
      <span class="q-tags">
        ${q.themeName ? `<span class="tag">${escapeHtml(q.themeName)}</span>` : ''}
        ${q.levelName ? `<span class="tag">${escapeHtml(q.levelName)}</span>` : ''}
      </span>
    </div>`;
  }).join('');

  // Event listeners
  questionList.querySelectorAll('.question-item').forEach(item => {
    item.addEventListener('click', () => {
      selectQuestion(parseInt(item.dataset.id, 10));
    });
  });
}

// ─── Actions ────────────────────────────────────────────────
async function selectQuestion(id) {
  const res = await apiCall('/api/game/select-question', 'POST', { questionId: id });
  if (res.success) showToast('Question sélectionnée', 'success');
}

async function validateAnswer(index) {
  const res = await apiCall('/api/game/validate-answer', 'POST', { propositionIndex: index });
  if (res.success) {
    showToast(res.data.isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse !', res.data.isCorrect ? 'success' : 'error');
  }
}

async function revealAnswer() {
  await apiCall('/api/game/reveal-answer', 'POST');
}

async function nextStep() {
  await apiCall('/api/game/next', 'POST');
}

async function resetGame() {
  if (confirm('Réinitialiser le jeu ? Les scores seront perdus.')) {
    await apiCall('/api/game/reset', 'POST');
    showToast('Jeu réinitialisé', 'info');
  }
}

async function refreshData() {
  btnRefresh.disabled = true;
  btnRefresh.textContent = '⟳ Chargement...';
  const res = await apiCall('/api/data/refresh', 'POST');
  if (res.success) {
    await loadAllData();
    showToast('Données rafraîchies depuis Google Sheets', 'success');
  }
  btnRefresh.disabled = false;
  btnRefresh.textContent = '↻ Rafraîchir';
}

async function selectRandom() {
  const body = {};
  if (filterMatiere.value) body.matiere = filterMatiere.value;
  if (filterCategory.value) body.category = filterCategory.value;
  if (filterTheme.value) body.theme = filterTheme.value;
  if (filterLevel.value) body.level = filterLevel.value;

  const res = await apiCall('/api/game/select-random', 'POST', body);
  if (res.success) showToast('Question aléatoire sélectionnée', 'success');
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
  wsStatus.className = 'status-badge connected';
  console.log('[WS] Connecté');
});

socket.on('disconnect', () => {
  wsStatus.className = 'status-badge disconnected';
  console.log('[WS] Déconnecté');
});

socket.on('game:state-update', (state) => {
  updateGameUI(state);
});

socket.on('data:refreshed', (info) => {
  loadAllData();
});

// ─── Event Listeners ────────────────────────────────────────
btnRefresh.addEventListener('click', refreshData);
btnReveal.addEventListener('click', revealAnswer);
btnNext.addEventListener('click', nextStep);
btnReset.addEventListener('click', resetGame);
btnRandom.addEventListener('click', selectRandom);

filterMatiere.addEventListener('change', renderQuestionList);
filterCategory.addEventListener('change', renderQuestionList);
filterTheme.addEventListener('change', renderQuestionList);
filterLevel.addEventListener('change', renderQuestionList);

btnStartWorkflow.addEventListener('click', startOrResetWorkflow);
btnResetWorkflow.addEventListener('click', startOrResetWorkflow);

// ─── Init ───────────────────────────────────────────────────
loadAllData();
