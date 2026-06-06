const config = require('./config');
const Logger = require('./logger');
const { validateQuestion, validateCommand, validateOverlayState, normalizeQuestion, validateId, validateLevels, validateCategories, validateThemes, validateMatieres } = require('./validators');
const rateLimit = require('express-rate-limit');

// Paramètres Google Sheets (optionnels)
const {
  googleSheets: {
    id: sheetId,
    serviceAccountEmail: saEmail,
    serviceAccountKey: saKey,
    ranges: {
      questions: questionsRange,
      themes: themesRange,
      categories: categoriesRange,
      levels: levelsRange,
      matieres: matieresRange
    }
  }
} = config;

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const router = express.Router();
const logger = new Logger(config.logLevel);

// En-têtes de sécurité (aucune requête en plus)
router.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Référence au serveur HTTP racine (pour route /shutdown)
let httpServer = null;
function setServer(s) {
  httpServer = s;
}

// Authentification par clé API pour les endpoints de contrôle.
// La clé est acceptée via l'en-tête `x-api-key` ou le paramètre `?apiKey=`
// (EventSource/OBS ne permet pas d'en-têtes personnalisés).
// Si aucune clé n'est configurée : accès libre (dev/local), avec avertissement en production.
let warnedNoApiKey = false;
function requireApiKey(req, res, next) {
  if (!config.apiKey) {
    if (config.isProduction && !warnedNoApiKey) {
      logger.warn('AUTH', 'API_KEY non configurée en production — les endpoints de contrôle ne sont PAS protégés.');
      warnedNoApiKey = true;
    }
    return next();
  }
  const provided = req.get('x-api-key') || req.query.apiKey || req.query.key;
  if (provided && provided === config.apiKey) {
    return next();
  }
  logger.warn('AUTH', `Accès refusé à ${req.method} ${req.path} (clé API manquante ou invalide)`);
  return res.status(401).json({ error: 'Clé API manquante ou invalide' });
}

let lastCommand = { id: 0, cmd: null, timestamp: 0 };
let overlayState = { question: null, timer: null, selectedIndex: null, timestamp: 0 };
const sseClients = []; // connexions SSE ouvertes (overlay)
const MAX_SSE_CLIENTS = 20; // plafond global de connexions SSE simultanées (anti-flood)

// Cache mémoire des données locales : évite de relire/reparser les JSON (dont
// questions.json ~2,4 Mo) à chaque requête. Invalidé après chaque sync Sheets.
const dataCache = new Map(); // filename -> JSON parsé
let questionsCache = null;   // tableau de questions normalisées

// Configuration CORS sécurisée
const corsOptions = {
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (mobile, desktop apps)
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS', `Accès non autorisé depuis: ${origin}`);
      callback(new Error('CORS non autorisé pour cette origine'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
};

router.use(cors(corsOptions));
router.use(express.json());

// Rate limiting pour protéger contre les attaques DoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isDevelopment ? 1000 : 100, // Limite plus permissive en développement
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

// Appliquer le rate limiting de manière conditionnelle
// Exclure /command et /state du rate limit : l’overlay poll /command toutes les 500 ms, la limite 100/15min provoquerait des 429.
// Ces routes sont protégées par API key en production.
router.use((req, res, next) => {
  const urlPath = req.path || (req.url ? req.url.split('?')[0] : '');
  const isStreamOrPollRoute = urlPath === '/command' || urlPath === '/command/stream' || urlPath === '/state';
  if (isStreamOrPollRoute) {
    return next();
  }
  limiter(req, res, next);
});

// Middleware d'erreur CORS
router.use((err, req, res, next) => {
  if (err.message === 'CORS non autorisé pour cette origine') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  next(err);
});

// Servir les données statiques sous /api/data (overlay et admin sont servis par le serveur racine)
router.use('/data', express.static(path.join(__dirname, '..', 'data')));

// Health check (publique) — indique si Google Sheets est configuré (sans exposer de secret)
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sheetsConfigured: Boolean(sheetId && saEmail && saKey),
    apiKeyRequired: Boolean(config.apiKey)
  });
});

// Arrêt du serveur (ferme le serveur HTTP racine si fourni)
router.post('/shutdown', requireApiKey, (req, res) => {
  logger.info('SERVER', 'Demande d\'arrêt reçue depuis l\'admin');
  res.json({ ok: true, message: 'Arrêt du serveur en cours...' });

  setTimeout(() => {
    logger.info('SERVER', 'Arrêt du serveur...');
    if (httpServer) {
      httpServer.close(() => {
        logger.info('SERVER', 'Serveur arrêté');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }, 500);
});

// Command bus
router.post('/command', requireApiKey, (req, res) => {
  if (!validateCommand(req.body)) {
    return res.status(400).json({ error: 'Commande invalide (champ "type" requis)' });
  }
  lastCommand = { id: lastCommand.id + 1, cmd: req.body, timestamp: Date.now() };
  res.json({ ok: true, id: lastCommand.id });
  const data = JSON.stringify(lastCommand);
  sseClients.forEach((entry) => {
    try {
      entry.res.write(`data: ${data}\n\n`);
    } catch (e) {}
  });
});

// Rate limit sur l’ouverture du flux SSE (évite le flood de connexions, pas de requêtes en plus)
const streamOpenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Trop de tentatives de connexion au flux.',
  standardHeaders: true,
  legacyHeaders: false
});

// Flux SSE : l’overlay reçoit les commandes en push (pas de polling)
// Clé API en query car EventSource ne permet pas d’en-têtes personnalisés
router.get('/command/stream', streamOpenLimiter, (req, res) => {
  if (sseClients.length >= MAX_SSE_CLIENTS) {
    logger.warn('SSE', `Connexion refusée: plafond de ${MAX_SSE_CLIENTS} flux atteint`);
    return res.status(503).json({ error: 'Trop de connexions au flux, réessayez plus tard.' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const entry = { res, key: '' };
  sseClients.push(entry);
  res.write(`data: ${JSON.stringify(lastCommand)}\n\n`);
  req.on('close', () => {
    const idx = sseClients.indexOf(entry);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Lecture des commandes (fallback polling)
router.get('/command', (_req, res) => {
  res.json(lastCommand);
});

// État de l'overlay
router.post('/state', requireApiKey, (req, res) => {
  if (!validateOverlayState(req.body)) {
    return res.status(400).json({ error: 'État invalide' });
  }
  overlayState = { ...req.body, timestamp: Date.now() };
  res.json({ ok: true });
});

router.get('/state', (_req, res) => {
  res.json(overlayState);
});


let sheetsClient = null;
const dataDir = path.join(__dirname, '..', 'data');

/**
 * Lit un fichier JSON du dossier data/ avec mise en cache mémoire.
 * Lève une erreur si le fichier est absent ou invalide (à gérer par l'appelant).
 */
function readData(filename) {
  if (dataCache.has(filename)) return dataCache.get(filename);
  const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf-8'));
  dataCache.set(filename, parsed);
  return parsed;
}

/** Variante tolérante : renvoie `fallback` au lieu de lever en cas d'erreur. */
function safeReadData(filename, fallback) {
  try {
    return readData(filename);
  } catch (_e) {
    return fallback;
  }
}

/** Vide les caches (appelé après un nouvel import depuis Google Sheets). */
function clearDataCaches() {
  dataCache.clear();
  questionsCache = null;
}

/**
 * Au démarrage : importe tout depuis Google Sheets vers les JSON locaux.
 * Après ce sync, l’app ne fait plus aucun appel réseau aux Sheets (usage 100 % local).
 */
async function syncSheetsToLocal() {
  if (!sheetId || !saEmail || !saKey) {
    logger.info('SYNC', 'Google Sheets non configuré — utilisation des JSON locaux existants.');
    return;
  }
  const client = buildSheetsClient();
  logger.info('SYNC', 'Import Google Sheets → JSON locaux en cours...');
  const [questionsRes, themesRes, categoriesRes, levelsRes, matieresRes] = await Promise.all([
    client.spreadsheets.values.get({ spreadsheetId: sheetId, range: questionsRange }),
    client.spreadsheets.values.get({ spreadsheetId: sheetId, range: themesRange }),
    client.spreadsheets.values.get({ spreadsheetId: sheetId, range: categoriesRange }),
    client.spreadsheets.values.get({ spreadsheetId: sheetId, range: levelsRange }),
    client.spreadsheets.values.get({ spreadsheetId: sheetId, range: matieresRange })
  ]);
  const questionsRows = questionsRes.data.values || [];
  const themesRows = themesRes.data.values || [];
  const categoriesRows = categoriesRes.data.values || [];
  const levelsRows = levelsRes.data.values || [];
  const matieresRows = matieresRes.data.values || [];

  const cell = (row, idx) => String((row && row[idx] != null) ? row[idx] : '').trim();

  const themesArr = themesRows
    .map(row => {
      const id = cell(row, 0);
      if (!id) return null;
      return { id, idCategory: cell(row, 1), idLevel: cell(row, 2), name: cell(row, 3), description: cell(row, 4) };
    })
    .filter(Boolean);
  const categoriesArr = categoriesRows
    .map(row => {
      const id = cell(row, 0);
      if (!id) return null;
      return { id, name: cell(row, 1), startDate: cell(row, 2), endDate: cell(row, 3), idMatiere: cell(row, 4) };
    })
    .filter(Boolean);
  const levelsArr = levelsRows
    .map(row => (cell(row, 0) ? { id: cell(row, 0), name: cell(row, 1) } : null))
    .filter(Boolean);
  const hasLevelsCol = matieresRows.some(row => String(row[2] || '').trim());
  const matieresArr = matieresRows
    .map(row => {
      const id = cell(row, 0);
      const name = cell(row, 1);
      if (!id || !name) return null;
      const m = { id, name };
      if (hasLevelsCol) m.levels = String(row[2] || '').split(',').map(s => s.trim()).filter(Boolean);
      return m;
    })
    .filter(Boolean);

  const themes = Object.fromEntries(themesArr.map(t => [t.id, t]));
  const categories = Object.fromEntries(categoriesArr.map(c => [c.id, c]));
  const levels = Object.fromEntries(levelsArr.map(l => [l.id, l.name]));
  const matieres = Object.fromEntries(matieresArr.map(m => [m.id, m.name]));

  const questionsMapped = questionsRows.map((row, idx) => {
    let id, idTheme, idLevel, question, rightAnswer, prop1, prop2, prop3, explications, typeQuestion;
    if (row.length >= 10) {
      [id, idTheme, idLevel, question, rightAnswer, prop1, prop2, prop3, explications, typeQuestion] = row.map(v => String(v ?? '').trim());
    } else {
      [id, idTheme, question, rightAnswer, prop1, prop2, prop3, explications, typeQuestion] = row.map(v => String(v ?? '').trim());
      idLevel = '';
    }
    id = String(id ?? '').trim();
    idTheme = String(idTheme ?? '').trim();
    idLevel = String(idLevel ?? '').trim();
    const theme = idTheme ? themes[idTheme] : null;
    const category = theme ? categories[theme.idCategory] : null;
    const matiere = category ? matieres[category.idMatiere] : null;
    const effectiveLevelId = (theme && theme.idLevel != null && String(theme.idLevel).trim()) ? String(theme.idLevel).trim() : (idLevel != null ? String(idLevel).trim() : '');
    const niveau = effectiveLevelId ? (levels[effectiveLevelId] || '') : '';

    const allPropositions = [prop1, prop2, prop3, rightAnswer].filter(Boolean);
    for (let i = allPropositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPropositions[i], allPropositions[j]] = [allPropositions[j], allPropositions[i]];
    }
    const bonneReponseIndex = allPropositions.indexOf(rightAnswer);

    return {
      id: id || idx + 1,
      idTheme,
      idLevel: effectiveLevelId,
      idCategory: theme?.idCategory || null,
      idMatiere: category?.idMatiere || null,
      question: question || '',
      propositions: allPropositions,
      bonneReponse: bonneReponseIndex,
      explication: explications || '',
      theme: theme?.name || '',
      category: category?.name || '',
      matiere: matiere || '',
      niveau: niveau || '',
      duration: 30
    };
  }).filter(q => q.question && q.propositions.length === 4);

  if (!questionsMapped.length) throw new Error('Aucune question valide dans le Sheet');

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'themes.json'), JSON.stringify(themesArr, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dataDir, 'categories.json'), JSON.stringify(categoriesArr, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dataDir, 'levels.json'), JSON.stringify(levelsArr, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dataDir, 'matieres.json'), JSON.stringify(matieresArr, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dataDir, 'questions.json'), JSON.stringify(questionsMapped, null, 2), 'utf-8');

  // Les fichiers locaux ont changé : on vide les caches pour servir les nouvelles données.
  clearDataCaches();

  logger.info('SYNC', `Import terminé: ${questionsMapped.length} questions, ${themesArr.length} thèmes, ${categoriesArr.length} catégories, ${levelsArr.length} niveaux, ${matieresArr.length} matières.`);
}

async function init() {
  if (sheetId && saEmail && saKey) {
    await syncSheetsToLocal();
  }
}

function loadQuestions() {
  // Résultat mis en cache : recalculé uniquement après un sync (clearDataCaches).
  if (questionsCache) return questionsCache;
  try {
    // Charger les tables locales (pour normaliser / joindre les IDs)
    const levels = safeReadData('levels.json', []);
    const matieres = safeReadData('matieres.json', []);
    const categories = safeReadData('categories.json', []);
    const themes = safeReadData('themes.json', []);

    // On log, mais on ne bloque pas si les validateurs sont trop permissifs
    if (!validateLevels(levels)) {
      logger.warn('DATA', 'levels.json invalide (format inattendu)');
    }
    if (!validateMatieres(matieres)) {
      logger.warn('DATA', 'matieres.json invalide (format inattendu)');
    }
    if (!validateCategories(categories)) {
      logger.warn('DATA', 'categories.json invalide (format inattendu)');
    }
    if (!validateThemes(themes)) {
      logger.warn('DATA', 'themes.json invalide (format inattendu)');
    }

    const levelById = Object.fromEntries((levels || []).map(l => [String(l.id), l]));
    const matiereById = Object.fromEntries((matieres || []).map(m => [String(m.id), m]));
    const categoryById = Object.fromEntries((categories || []).map(c => [String(c.id), c]));
    const themeById = Object.fromEntries((themes || []).map(t => [String(t.id), t]));

    const questionsRaw = readData('questions.json');
    if (!Array.isArray(questionsRaw)) {
      throw new Error('Format invalide: questions.json doit être un tableau');
    }

    const shuffleInPlace = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    };

    const normalizeLocalQuestion = (q, idx) => {
      const idTheme = q.idTheme != null ? String(q.idTheme) : '';

      // Déduire idCategory depuis le thème si absent
      const theme = idTheme ? themeById[idTheme] : null;
      // Dans le MLD: Question -> Theme, et Theme -> Level. Donc idLevel est normalement dérivé du thème.
      const idLevel = q.idLevel != null
        ? String(q.idLevel)
        : (theme && theme.idLevel != null ? String(theme.idLevel) : '');
      const idCategory = q.idCategory != null
        ? String(q.idCategory)
        : (theme && theme.idCategory != null ? String(theme.idCategory) : '');

      const category = idCategory ? categoryById[idCategory] : null;
      const matiere = category && category.idMatiere != null ? matiereById[String(category.idMatiere)] : null;
      const niveau = idLevel ? levelById[idLevel] : null;

      // Support de 2 formats:
      // 1) format "overlay-ready": propositions[] + bonneReponse
      // 2) format "table" (CSV / Sheets): rightAnswer + proposition1/2/3
      let propositions = Array.isArray(q.propositions) ? q.propositions.slice() : null;
      let bonneReponse = typeof q.bonneReponse === 'number' ? q.bonneReponse : null;

      if (!propositions || bonneReponse === null) {
        const rightAnswer = (q.rightAnswer ?? '').toString().trim();
        const prop1 = (q.proposition1 ?? '').toString().trim();
        const prop2 = (q.proposition2 ?? '').toString().trim();
        const prop3 = (q.proposition3 ?? '').toString().trim();
        const all = [prop1, prop2, prop3, rightAnswer].filter(Boolean);
        if (all.length === 4) {
          shuffleInPlace(all);
          const idxGood = all.indexOf(rightAnswer);
          if (idxGood >= 0) {
            propositions = all;
            bonneReponse = idxGood;
          }
        }
      }

      return {
        id: q.id != null ? q.id : (idx + 1),
        idTheme,
        idLevel,
        idCategory,
        question: q.question || '',
        propositions: propositions || [],
        bonneReponse: bonneReponse ?? -1,
        explication: q.explication || q.explications || '',
        theme: (theme && theme.name) ? theme.name : (q.theme || ''),
        category: (category && category.name) ? category.name : (q.category || ''),
        matiere: (matiere && matiere.name) ? matiere.name : (q.matiere || ''),
        niveau: (niveau && niveau.name) ? niveau.name : (q.niveau || ''),
        duration: q.duration || 30
      };
    };

    // Normaliser + valider
    const validQuestions = questionsRaw
      .map((q, idx) => normalizeLocalQuestion(q, idx))
      .filter(q => {
        const isValid = validateQuestion(q);
        if (!isValid) {
          logger.warn('DATA', `Question invalide ignorée: ${q.id || 'sans ID'}`);
        }
        return isValid;
      });

    questionsCache = validQuestions;
    return questionsCache;
  } catch (err) {
    logger.error('DATA', `Erreur chargement questions.json: ${err.message}`);
    return [];
  }
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildSheetsClient() {
  if (sheetsClient) return sheetsClient;
  if (!sheetId || !saEmail || !saKey) {
    throw new Error('Variables d’environnement Google Sheets manquantes');
  }
  const cleanedKey = saKey.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: saEmail,
    key: cleanedKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

router.get('/matieres', (_req, res) => {
  try {
    const matieres = readData('matieres.json');
    if (!validateMatieres(matieres)) {
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    res.json(matieres);
  } catch (err) {
    logger.error('API', `Erreur chargement matières: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les matières' });
  }
});

router.get('/levels', (_req, res) => {
  try {
    const levels = readData('levels.json');
    if (!validateLevels(levels)) {
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    res.json(levels);
  } catch (err) {
    logger.error('API', `Erreur chargement niveaux: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les niveaux' });
  }
});

router.get('/categories', (req, res) => {
  try {
    const matiereId = req.query.matiereId;
    const levelId = req.query.levelId;
    if (matiereId && !validateId(String(matiereId))) {
      return res.status(400).json({ error: 'ID de matière invalide' });
    }
    if (levelId && !validateId(String(levelId))) {
      return res.status(400).json({ error: 'ID de niveau invalide' });
    }
    let categories = readData('categories.json');
    if (!validateCategories(categories)) {
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    if (matiereId) {
      categories = categories.filter(c => String(c.idMatiere) === String(matiereId));
    }
    if (levelId) {
      const themes = readData('themes.json');
      const allowedCategoryIds = new Set(
        (themes || [])
          .filter(t => String(t.idLevel ?? '') === String(levelId))
          .map(t => String(t.idCategory ?? ''))
          .filter(Boolean)
      );
      categories = categories.filter(c => allowedCategoryIds.has(String(c.id)));
    }
    res.json(categories);
  } catch (err) {
    logger.error('API', `Erreur chargement catégories: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les catégories' });
  }
});

router.get('/themes', (req, res) => {
  try {
    const categoryId = req.query.categoryId;
    const levelId = req.query.levelId;
    if (categoryId && !validateId(String(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }
    if (levelId && !validateId(String(levelId))) {
      return res.status(400).json({ error: 'ID de niveau invalide' });
    }
    let themes = readData('themes.json');
    if (!validateThemes(themes)) {
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    if (categoryId) {
      themes = themes.filter(t => String(t.idCategory) === String(categoryId));
    }
    if (levelId) {
      themes = themes.filter(t => String(t.idLevel) === String(levelId));
    }
    res.json(themes);
  } catch (err) {
    logger.error('API', `Erreur chargement thèmes: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les thèmes' });
  }
});

router.get('/random', (req, res) => {
  try {
    const { matiereId, levelId, categoryId, themeId } = req.query;
    // Valider les IDs si fournis
    if (matiereId && !validateId(String(matiereId))) {
      return res.status(400).json({ error: 'ID de matière invalide' });
    }
    if (levelId && !validateId(String(levelId))) {
      return res.status(400).json({ error: 'ID de niveau invalide' });
    }
    if (categoryId && !validateId(String(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }
    if (themeId && !validateId(String(themeId))) {
      return res.status(400).json({ error: 'ID de thème invalide' });
    }
    
    let questions = loadQuestions();
    // Filtrer selon les critères
    if (matiereId) {
      const categories = readData('categories.json');
      const categoryIdsForMatiere = categories
        .filter(c => String(c.idMatiere) === String(matiereId))
        .map(c => String(c.id));
      questions = questions.filter(q => {
        const qCategoryId = String(q.idCategory || '');
        return categoryIdsForMatiere.includes(qCategoryId);
      });
    }
    
    if (levelId) {
      questions = questions.filter(q => String(q.idLevel) === String(levelId));
    }
    
    if (categoryId) {
      questions = questions.filter(q => String(q.idCategory) === String(categoryId));
    }
    
    if (themeId) {
      questions = questions.filter(q => String(q.idTheme) === String(themeId));
    }
    if (!questions.length) {
      logger.warn('API', 'Aucune question trouvée avec critères', { matiereId, levelId, categoryId, themeId });
      return res.status(404).json({ error: 'Aucune question trouvée avec ces critères' });
    }
    
    const selected = pickRandom(questions);
    if (!selected) {
      return res.status(404).json({ error: 'Aucune question disponible' });
    }
    
    return res.json(selected);
  } catch (err) {
    logger.error('API', `Erreur chargement questions: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les questions' });
  }
});

/**
 * GET /questions — Liste toutes les questions pour les filtres donnés (même logique que /random).
 * Utilisé par l'admin pour enchaîner les questions du thème sans répétition.
 */
router.get('/questions', (req, res) => {
  try {
    const { matiereId, levelId, categoryId, themeId } = req.query;
    if (matiereId && !validateId(String(matiereId))) {
      return res.status(400).json({ error: 'ID de matière invalide' });
    }
    if (levelId && !validateId(String(levelId))) {
      return res.status(400).json({ error: 'ID de niveau invalide' });
    }
    if (categoryId && !validateId(String(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }
    if (themeId && !validateId(String(themeId))) {
      return res.status(400).json({ error: 'ID de thème invalide' });
    }
    let questions = loadQuestions();
    if (matiereId) {
      const categories = readData('categories.json');
      const categoryIdsForMatiere = categories
        .filter(c => String(c.idMatiere) === String(matiereId))
        .map(c => String(c.id));
      questions = questions.filter(q => categoryIdsForMatiere.includes(String(q.idCategory || '')));
    }
    if (levelId) {
      questions = questions.filter(q => String(q.idLevel) === String(levelId));
    }
    if (categoryId) {
      questions = questions.filter(q => String(q.idCategory) === String(categoryId));
    }
    if (themeId) {
      questions = questions.filter(q => String(q.idTheme) === String(themeId));
    }
    res.json(questions);
  } catch (err) {
    logger.error('API', `Erreur GET /questions: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les questions' });
  }
});

// Middleware d'erreur global (DOIT être à la fin)
router.use((err, req, res, next) => {
  logger.error('SERVER', `Erreur non gérée: ${err.message}`);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

module.exports = { router, setServer, init };
