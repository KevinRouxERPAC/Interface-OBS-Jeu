/**
 * Schémas de validation pour les données
 */

/**
 * Valide une question
 */
function validateQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  if (!q.question || typeof q.question !== 'string') return false;
  if (!Array.isArray(q.propositions) || q.propositions.length !== 4) return false;
  if (!q.propositions.every(p => typeof p === 'string' && p.trim())) return false;
  if (typeof q.bonneReponse !== 'number' || q.bonneReponse < 0 || q.bonneReponse > 3) return false;
  return true;
}

/**
 * Valide une commande
 */
function validateCommand(cmd) {
  if (!cmd || typeof cmd !== 'object') return false;
  if (!cmd.type || typeof cmd.type !== 'string') return false;
  return true;
}

/**
 * Valide un état d'overlay
 */
function validateOverlayState(state) {
  if (!state || typeof state !== 'object') return false;
  // state.question peut être null
  if (state.question !== null && !validateQuestion(state.question)) return false;
  // state.timer peut être null ou un nombre
  if (state.timer !== null && typeof state.timer !== 'number') return false;
  // state.selectedIndex peut être null ou un nombre 0-3
  if (state.selectedIndex !== null && (typeof state.selectedIndex !== 'number' || state.selectedIndex < 0 || state.selectedIndex > 3)) return false;
  return true;
}

/**
 * Normalise une question depuis le JSON local
 */
function normalizeQuestion(q) {
  return {
    id: q.id,
    question: q.question,
    propositions: q.propositions,
    bonneReponse: q.bonneReponse,
    explication: q.explication || '',
    theme: q.theme || '',
    matiere: q.matiere || '',
    niveau: q.niveau || '',
    duration: q.duration || 30
  };
}

/**
 * Valide un ID (alphanumérique, tirets, underscores)
 */
function validateId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Valide un tableau de niveaux
 */
function validateLevels(levels) {
  if (!Array.isArray(levels)) return false;
  return levels.every(level => 
    level && 
    typeof level === 'object' &&
    (typeof level.id === 'string' || typeof level.id === 'number') &&
    typeof level.name === 'string'
  );
}

/**
 * Valide un tableau de catégories
 */
function validateCategories(categories) {
  if (!Array.isArray(categories)) return false;
  return categories.every(cat => 
    cat && 
    typeof cat === 'object' &&
    (typeof cat.id === 'string' || typeof cat.id === 'number') &&
    typeof cat.name === 'string'
  );
}

/**
 * Valide un tableau de thèmes
 */
function validateThemes(themes) {
  if (!Array.isArray(themes)) return false;
  return themes.every(theme => 
    theme && 
    typeof theme === 'object' &&
    (typeof theme.id === 'string' || typeof theme.id === 'number') &&
    typeof theme.name === 'string'
  );
}

module.exports = {
  validateQuestion,
  validateCommand,
  validateOverlayState,
  normalizeQuestion,
  validateId,
  validateLevels,
  validateCategories,
  validateThemes
};
