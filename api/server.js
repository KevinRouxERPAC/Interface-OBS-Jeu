const config = require('./config');
const Logger = require('./logger');
const { validateQuestion, validateCommand, validateOverlayState, normalizeQuestion, validateId, validateLevels, validateCategories, validateThemes } = require('./validators');
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

const app = express();
const logger = new Logger(config.logLevel);
const questionsPath = path.join(__dirname, '..', 'data', 'questions.json');

let lastCommand = { id: 0, cmd: null, timestamp: 0 };
let overlayState = { question: null, timer: null, selectedIndex: null, timestamp: 0 };

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
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  credentials: false
};

app.use(cors(corsOptions));
app.use(express.json());

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
// En développement, on skip pour les routes critiques de l'admin
app.use((req, res, next) => {
  // Extraire le path de manière fiable depuis req.url
  const urlPath = req.path || (req.url ? req.url.split('?')[0] : '');
  const shouldSkip = config.isDevelopment && (
    urlPath.startsWith('/admin') || 
    urlPath === '/command' || 
    urlPath === '/state'
  );
  
  if (shouldSkip) {
    return next(); // Skip rate limiting
  }
  
  limiter(req, res, next);
});

// Middleware de validation de la clé API
const validateApiKey = (req, res, next) => {
  // En développement, on ignore complètement la clé API
  if (config.isDevelopment) {
    return next(); // Pas de vérification en développement
  }

  // En production uniquement, validation stricte
  if (!config.apiKey) {
    logger.warn('API', 'Mode production sans clé API configurée - toutes les requêtes sont acceptées');
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== config.apiKey) {
    logger.warn('API', 'Tentative d\'accès sans clé API valide');
    return res.status(401).json({ error: 'Clé API invalide ou manquante' });
  }
  next();
};

// Middleware d'erreur CORS
app.use((err, req, res, next) => {
  if (err.message === 'CORS non autorisé pour cette origine') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  next(err);
});

// Servir les fichiers statiques
app.use('/overlay', express.static(path.join(__dirname, '..', 'overlay')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

// Health check (publique)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Arrêt du serveur - PROTÉGÉ par API Key
app.post('/shutdown', validateApiKey, (req, res) => {
  logger.info('SERVER', 'Demande d\'arrêt reçue depuis l\'admin');
  res.json({ ok: true, message: 'Arrêt du serveur en cours...' });
  
  // Arrêt gracieux après un court délai pour permettre la réponse
  setTimeout(() => {
    logger.info('SERVER', 'Arrêt du serveur...');
    server.close(() => {
      logger.info('SERVER', 'Serveur arrêté');
      process.exit(0);
    });
  }, 500);
});

// Command bus - PROTÉGÉ par API Key
app.post('/command', validateApiKey, (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Commande invalide' });
  }
  lastCommand = { id: lastCommand.id + 1, cmd: req.body, timestamp: Date.now() };
  res.json({ ok: true, id: lastCommand.id });
});

// Lecture des commandes - PROTÉGÉ par API Key
app.get('/command', validateApiKey, (_req, res) => {
  res.json(lastCommand);
});

// État de l'overlay - PROTÉGÉ par API Key
app.post('/state', validateApiKey, (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: 'État invalide' });
  }
  overlayState = { ...req.body, timestamp: Date.now() };
  res.json({ ok: true });
});

app.get('/state', validateApiKey, (_req, res) => {
  res.json(overlayState);
});


let sheetsClient = null;

function loadQuestions() {
  try {
    const raw = fs.readFileSync(questionsPath, 'utf-8');
    const questions = JSON.parse(raw);
    if (!Array.isArray(questions)) {
      throw new Error('Format invalide: questions.json doit être un tableau');
    }
    // Valider chaque question
    const validQuestions = questions.filter(q => {
      const isValid = validateQuestion(q);
      if (!isValid) {
        logger.warn('DATA', `Question invalide ignorée: ${q.id || 'sans ID'}`);
      }
      return isValid;
    });
    return validQuestions;
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

async function fetchQuestionsFromSheets() {
  try {
    const client = buildSheetsClient();
    
    // Lecture de tous les onglets en parallèle
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

  if (!questionsRows.length) throw new Error('Aucune question trouvée dans le Sheet');

  // Construction des tables de lookup
  const themes = Object.fromEntries(
    themesRows.map(row => [row[0], { id: row[0], idCategory: row[1], name: row[2], description: row[3] }])
  );
  const categories = Object.fromEntries(
    categoriesRows.map(row => [row[0], { id: row[0], name: row[1], startDate: row[2], endDate: row[3], idMatiere: row[4] }])
  );
  const levels = Object.fromEntries(
    levelsRows.map(row => [row[0], row[1]])
  );
  const matieres = Object.fromEntries(
    matieresRows.map(row => [row[0], row[1]])
  );

  // Mapping des questions avec jointures
  const mapped = questionsRows.map((row, idx) => {
    const [id, idTheme, idLevel, question, rightAnswer, prop1, prop2, prop3, explications, typeQuestion] = row;
    
    const theme = themes[idTheme];
    const category = theme ? categories[theme.idCategory] : null;
    const matiere = category ? matieres[category.idMatiere] : null;
    const niveau = levels[idLevel];

    // Construction des 4 propositions : les 3 fausses + la bonne réponse
    // On mélange pour que la bonne réponse ne soit pas toujours en position 0
    const allPropositions = [prop1, prop2, prop3, rightAnswer].filter(Boolean);
    
    // Mélange aléatoire (Fisher-Yates)
    for (let i = allPropositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPropositions[i], allPropositions[j]] = [allPropositions[j], allPropositions[i]];
    }

    // Trouver l'index de la bonne réponse après mélange
    const bonneReponseIndex = allPropositions.indexOf(rightAnswer);

    return {
      id: id || idx + 1,
      idTheme: idTheme,
      idLevel: idLevel,
      idCategory: theme?.idCategory || null,
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

    if (!mapped.length) throw new Error('Données Sheets invalides');
    return mapped;
  } catch (err) {
    logger.error('SHEETS', `Erreur chargement Google Sheets: ${err.message}`);
    throw err; // Re-lancer pour déclencher le fallback JSON
  }
}

app.get('/levels', async (_req, res) => {
  try {
    if (sheetId && saEmail && saKey) {
      const client = buildSheetsClient();
      const levelsRes = await client.spreadsheets.values.get({ 
        spreadsheetId: sheetId, 
        range: levelsRange 
      });
      const levelsRows = levelsRes.data.values || [];
      const levels = levelsRows.map(row => ({ id: row[0], name: row[1] }));
      if (!validateLevels(levels)) {
        logger.warn('DATA', 'Niveaux Sheets invalides, fallback JSON');
        throw new Error('Format invalide');
      }
      return res.json(levels);
    }
    // Fallback JSON local
    const levelsPath = path.join(__dirname, '..', 'data', 'levels.json');
    const levelsJSON = fs.readFileSync(levelsPath, 'utf-8');
    const levels = JSON.parse(levelsJSON);
    if (!validateLevels(levels)) {
      logger.error('DATA', 'Format levels.json invalide');
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    res.json(levels);
  } catch (err) {
    logger.error('API', `Erreur chargement niveaux: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les niveaux' });
  }
});

app.get('/categories', async (_req, res) => {
  try {
    if (sheetId && saEmail && saKey) {
      const client = buildSheetsClient();
      const categoriesRes = await client.spreadsheets.values.get({ 
        spreadsheetId: sheetId, 
        range: categoriesRange 
      });
      const categoriesRows = categoriesRes.data.values || [];
      const categories = categoriesRows.map(row => ({ 
        id: row[0], 
        name: row[1], 
        idMatiere: row[4] 
      }));
      if (!validateCategories(categories)) {
        logger.warn('DATA', 'Catégories Sheets invalides, fallback JSON');
        throw new Error('Format invalide');
      }
      return res.json(categories);
    }
    // Fallback JSON local
    const categoriesPath = path.join(__dirname, '..', 'data', 'categories.json');
    const categoriesJSON = fs.readFileSync(categoriesPath, 'utf-8');
    const categories = JSON.parse(categoriesJSON);
    if (!validateCategories(categories)) {
      logger.error('DATA', 'Format categories.json invalide');
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    res.json(categories);
  } catch (err) {
    logger.error('API', `Erreur chargement catégories: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les catégories' });
  }
});

app.get('/themes', async (req, res) => {
  try {
    const categoryId = req.query.categoryId;
    
    // Valider categoryId si fourni
    if (categoryId && !validateId(String(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }
    
    if (sheetId && saEmail && saKey) {
      const client = buildSheetsClient();
      const themesRes = await client.spreadsheets.values.get({ 
        spreadsheetId: sheetId, 
        range: themesRange 
      });
      const themesRows = themesRes.data.values || [];
      let themes = themesRows.map(row => ({ 
        id: row[0], 
        idCategory: row[1], 
        name: row[2] 
      }));
      
      if (!validateThemes(themes)) {
        logger.warn('DATA', 'Thèmes Sheets invalides, fallback JSON');
        throw new Error('Format invalide');
      }
      
      if (categoryId) {
        themes = themes.filter(t => String(t.idCategory) === String(categoryId));
      }
      
      return res.json(themes);
    }
    // Fallback JSON local
    const themesPath = path.join(__dirname, '..', 'data', 'themes.json');
    const themesJSON = fs.readFileSync(themesPath, 'utf-8');
    let themes = JSON.parse(themesJSON);
    
    if (!validateThemes(themes)) {
      logger.error('DATA', 'Format themes.json invalide');
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    
    if (categoryId) {
      themes = themes.filter(t => String(t.idCategory) === String(categoryId));
    }
    
    res.json(themes);
  } catch (err) {
    logger.error('API', `Erreur chargement thèmes: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les thèmes' });
  }
});

app.get('/random', async (req, res) => {
  try {
    const { levelId, categoryId, themeId } = req.query;
    
    // Valider les IDs si fournis
    if (levelId && !validateId(String(levelId))) {
      return res.status(400).json({ error: 'ID de niveau invalide' });
    }
    if (categoryId && !validateId(String(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }
    if (themeId && !validateId(String(themeId))) {
      return res.status(400).json({ error: 'ID de thème invalide' });
    }
    
    let questions = [];
    
    // Priorité Sheets si configuré
    if (sheetId && saEmail && saKey) {
      try {
        questions = await fetchQuestionsFromSheets();
      } catch (err) {
        logger.warn('API', 'Erreur Sheets, fallback JSON', { error: err.message });
        // Fallback vers JSON local
        questions = loadQuestions();
      }
    } else {
      // Fallback JSON local
      questions = loadQuestions();
    }
    
    // Filtrer selon les critères
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
      logger.warn('API', 'Aucune question trouvée avec critères', { levelId, categoryId, themeId });
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

// Middleware d'erreur global (DOIT être à la fin)
app.use((err, req, res, next) => {
  logger.error('SERVER', `Erreur non gérée: ${err.message}`);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// Démarrage du serveur
const server = app.listen(config.port, () => {
  logger.info('SERVER', `API quiz démarrée`, { 
    port: config.port, 
    env: config.nodeEnv,
    origins: config.allowedOrigins 
  });
});

// Gestion des arrêts gracieux
process.on('SIGTERM', () => {
  logger.info('SERVER', 'Signal SIGTERM reçu, arrêt gracieux...');
  server.close(() => {
    logger.info('SERVER', 'Serveur arrêté');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SERVER', 'Signal SIGINT reçu, arrêt gracieux...');
  server.close(() => {
    logger.info('SERVER', 'Serveur arrêté');
    process.exit(0);
  });
});
