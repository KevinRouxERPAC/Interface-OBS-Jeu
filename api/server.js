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

// Référence au serveur HTTP racine (pour route /shutdown)
let httpServer = null;
function setServer(s) {
  httpServer = s;
}
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
  const isPollingRoute = urlPath === '/command' || urlPath === '/state';
  if (isPollingRoute) {
    return next();
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
    sheetsConfigured: Boolean(sheetId && saEmail && saKey)
  });
});

// Arrêt du serveur - PROTÉGÉ par API Key (ferme le serveur HTTP racine si fourni)
router.post('/shutdown', validateApiKey, (req, res) => {
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

// Command bus - PROTÉGÉ par API Key
router.post('/command', validateApiKey, (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Commande invalide' });
  }
  lastCommand = { id: lastCommand.id + 1, cmd: req.body, timestamp: Date.now() };
  res.json({ ok: true, id: lastCommand.id });
});

// Lecture des commandes - PROTÉGÉ par API Key
router.get('/command', validateApiKey, (_req, res) => {
  res.json(lastCommand);
});

// État de l'overlay - PROTÉGÉ par API Key
router.post('/state', validateApiKey, (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: 'État invalide' });
  }
  overlayState = { ...req.body, timestamp: Date.now() };
  res.json({ ok: true });
});

router.get('/state', validateApiKey, (_req, res) => {
  res.json(overlayState);
});


let sheetsClient = null;

function loadQuestions() {
  try {
    // Charger les tables locales (pour normaliser / joindre les IDs)
    const levelsPath = path.join(__dirname, '..', 'data', 'levels.json');
    const matieresPath = path.join(__dirname, '..', 'data', 'matieres.json');
    const categoriesPath = path.join(__dirname, '..', 'data', 'categories.json');
    const themesPath = path.join(__dirname, '..', 'data', 'themes.json');

    const safeReadJson = (p, fallback) => {
      try {
        if (!fs.existsSync(p)) return fallback;
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch (_e) {
        return fallback;
      }
    };

    const levels = safeReadJson(levelsPath, []);
    const matieres = safeReadJson(matieresPath, []);
    const categories = safeReadJson(categoriesPath, []);
    const themes = safeReadJson(themesPath, []);

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

    const raw = fs.readFileSync(questionsPath, 'utf-8');
    const questionsRaw = JSON.parse(raw);
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

  const cell = (row, idx) => String((row && row[idx] != null) ? row[idx] : '').trim();

  // Construction des tables de lookup
  const themes = Object.fromEntries(
    // MLD attendu: Theme = (ID, IDCategory, IDLevel, Name, Description)
    themesRows
      .map(row => {
        const id = cell(row, 0);
        if (!id) return null;
        return [
          id,
          {
            id,
            idCategory: cell(row, 1),
            idLevel: cell(row, 2),
            name: cell(row, 3),
            description: cell(row, 4)
          }
        ];
      })
      .filter(Boolean)
  );
  const categories = Object.fromEntries(
    categoriesRows
      .map(row => {
        const id = cell(row, 0);
        if (!id) return null;
        return [
          id,
          {
            id,
            name: cell(row, 1),
            startDate: cell(row, 2),
            endDate: cell(row, 3),
            idMatiere: cell(row, 4)
          }
        ];
      })
      .filter(Boolean)
  );
  const levels = Object.fromEntries(
    levelsRows
      .map(row => [cell(row, 0), cell(row, 1)])
      .filter(([id]) => Boolean(id))
  );
  const matieres = Object.fromEntries(
    matieresRows
      .map(row => [cell(row, 0), cell(row, 1)])
      .filter(([id]) => Boolean(id))
  );

  // Mapping des questions avec jointures
  const mapped = questionsRows.map((row, idx) => {
    // Support de 2 formats (compat):
    // - Nouveau MLD: Questions = (ID, IDTheme, Question, Right_Answer, Prop1, Prop2, Prop3, Explications, Type_Question)  -> 9 colonnes
    // - Ancien format: Questions = (ID, IDTheme, IDLevel, Question, ...) -> 10 colonnes
    let id, idTheme, idLevel, question, rightAnswer, prop1, prop2, prop3, explications, typeQuestion;
    if (row.length >= 10) {
      [id, idTheme, idLevel, question, rightAnswer, prop1, prop2, prop3, explications, typeQuestion] = row.map(v => String(v ?? '').trim());
    } else {
      [id, idTheme, question, rightAnswer, prop1, prop2, prop3, explications, typeQuestion] = row.map(v => String(v ?? '').trim());
    }

    id = String(id ?? '').trim();
    idTheme = String(idTheme ?? '').trim();
    idLevel = String(idLevel ?? '').trim();
    question = String(question ?? '').trim();
    rightAnswer = String(rightAnswer ?? '').trim();
    prop1 = String(prop1 ?? '').trim();
    prop2 = String(prop2 ?? '').trim();
    prop3 = String(prop3 ?? '').trim();
    explications = String(explications ?? '').trim();
    typeQuestion = String(typeQuestion ?? '').trim();

    const theme = idTheme ? themes[idTheme] : null;
    const category = theme ? categories[theme.idCategory] : null;
    const matiere = category ? matieres[category.idMatiere] : null;
    // Dans le MLD: le niveau est celui du thème. Si l'ancien format fournit un idLevel, on le tolère,
    // mais on privilégie Theme.idLevel quand il existe.
    const effectiveLevelId = (theme && theme.idLevel != null && String(theme.idLevel).trim())
      ? String(theme.idLevel).trim()
      : (idLevel != null ? String(idLevel).trim() : '');
    const niveau = effectiveLevelId ? levels[effectiveLevelId] : '';

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

    if (!mapped.length) throw new Error('Données Sheets invalides');
    return mapped;
  } catch (err) {
    logger.error('SHEETS', `Erreur chargement Google Sheets: ${err.message}`);
    throw err; // Re-lancer pour déclencher le fallback JSON
  }
}

router.get('/matieres', async (_req, res) => {
  try {
    if (sheetId && saEmail && saKey) {
      try {
        const client = buildSheetsClient();
        const matieresRes = await client.spreadsheets.values.get({ 
          spreadsheetId: sheetId, 
          range: matieresRange 
        });
        const matieresRows = matieresRes.data.values || [];
        // MLD attendu: Matiere = (ID, Nom)
        // On tolère une 3e colonne optionnelle "levels" (liste) pour rétrocompat, mais le modèle ne l'exige pas.
        const hasLevelsColumn = matieresRows.some(row => String(row[2] || '').trim());
        const matieres = matieresRows.map(row => ({
          id: String(row[0] ?? '').trim(),
          name: String(row[1] ?? '').trim(),
          ...(hasLevelsColumn
            ? { levels: String(row[2] || '').split(',').map(s => s.trim()).filter(Boolean) }
            : {})
        })).filter(m => m.id && m.name);
        
        if (!validateMatieres(matieres)) {
          logger.warn('DATA', 'Matières Sheets invalides, fallback JSON');
          throw new Error('Format invalide');
        }
        logger.info('API', `Matières chargées depuis Google Sheets: ${matieres.length}`);
        return res.json(matieres);
      } catch (sheetsErr) {
        logger.warn('API', `Erreur Google Sheets, fallback JSON: ${sheetsErr.message}`);
        // Continue vers le fallback JSON
      }
    }
    // Fallback JSON local
    const matieresPath = path.join(__dirname, '..', 'data', 'matieres.json');
    const matieresJSON = fs.readFileSync(matieresPath, 'utf-8');
    const matieres = JSON.parse(matieresJSON);
    
    logger.info('API', `Matières chargées depuis JSON local: ${matieres.length}`);
    if (matieres.length > 0) {
      logger.info('API', `Première matière: ${JSON.stringify(matieres[0])}`);
    }
    
    if (!validateMatieres(matieres)) {
      logger.error('DATA', 'Format matieres.json invalide');
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    res.json(matieres);
  } catch (err) {
    logger.error('API', `Erreur chargement matières: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les matières' });
  }
});

router.get('/levels', async (_req, res) => {
  try {
    if (sheetId && saEmail && saKey) {
      try {
        const client = buildSheetsClient();
        const levelsRes = await client.spreadsheets.values.get({ 
          spreadsheetId: sheetId, 
          range: levelsRange 
        });
        const levelsRows = levelsRes.data.values || [];
        const levels = levelsRows
          .map(row => ({ id: String(row[0] ?? '').trim(), name: String(row[1] ?? '').trim() }))
          .filter(l => l.id && l.name);
        if (!validateLevels(levels)) {
          logger.warn('DATA', 'Niveaux Sheets invalides, fallback JSON');
          throw new Error('Format invalide');
        }
        return res.json(levels);
      } catch (sheetsErr) {
        logger.warn('API', `Erreur Google Sheets niveaux, fallback JSON: ${sheetsErr.message}`);
      }
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

router.get('/categories', async (req, res) => {
  try {
    const matiereId = req.query.matiereId;
    const levelId = req.query.levelId;
    
    // Valider matiereId si fourni
    if (matiereId && !validateId(String(matiereId))) {
      return res.status(400).json({ error: 'ID de matière invalide' });
    }
    // Valider levelId si fourni
    if (levelId && !validateId(String(levelId))) {
      return res.status(400).json({ error: 'ID de niveau invalide' });
    }
    
    if (sheetId && saEmail && saKey) {
      try {
        const client = buildSheetsClient();
        const categoriesRes = await client.spreadsheets.values.get({ spreadsheetId: sheetId, range: categoriesRange });
        const categoriesRows = categoriesRes.data.values || [];
        let themesRows = [];
        if (levelId) {
          const themesRes = await client.spreadsheets.values.get({ spreadsheetId: sheetId, range: themesRange });
          themesRows = themesRes.data.values || [];
        }
        let categories = categoriesRows.map(row => ({ 
          id: String(row[0] ?? '').trim(),
          name: String(row[1] ?? '').trim(),
          startDate: String(row[2] ?? '').trim(),
          endDate: String(row[3] ?? '').trim(),
          idMatiere: String(row[4] ?? '').trim()
        })).filter(c => c.id && c.name && c.idMatiere);
        
        if (!validateCategories(categories)) {
          logger.warn('DATA', 'Catégories Sheets invalides, fallback JSON');
          throw new Error('Format invalide');
        }
        
        if (matiereId) {
          categories = categories.filter(c => String(c.idMatiere) === String(matiereId));
        }

        // Filtre par niveau via Theme(IDLevel) => Category
        if (levelId) {
          const allowedCategoryIds = new Set(
            themesRows
              .filter(r => String(r[2] ?? '').trim() === String(levelId))
              .map(r => String(r[1] ?? '').trim())
              .filter(Boolean)
          );
          categories = categories.filter(c => allowedCategoryIds.has(String(c.id)));
        }
        
        return res.json(categories);
      } catch (sheetsErr) {
        logger.warn('API', `Erreur Google Sheets catégories, fallback JSON: ${sheetsErr.message}`);
      }
    }
    // Fallback JSON local
    const categoriesPath = path.join(__dirname, '..', 'data', 'categories.json');
    const categoriesJSON = fs.readFileSync(categoriesPath, 'utf-8');
    let categories = JSON.parse(categoriesJSON);
    
    if (!validateCategories(categories)) {
      logger.error('DATA', 'Format categories.json invalide');
      return res.status(500).json({ error: 'Format de données invalide' });
    }
    
    if (matiereId) {
      categories = categories.filter(c => String(c.idMatiere) === String(matiereId));
    }

    if (levelId) {
      const themesPath = path.join(__dirname, '..', 'data', 'themes.json');
      const themesJSON = fs.readFileSync(themesPath, 'utf-8');
      const themes = JSON.parse(themesJSON);
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

router.get('/themes', async (req, res) => {
  try {
    const categoryId = req.query.categoryId;
    const levelId = req.query.levelId;
    
    // Valider categoryId si fourni
    if (categoryId && !validateId(String(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }
    // Valider levelId si fourni
    if (levelId && !validateId(String(levelId))) {
      return res.status(400).json({ error: 'ID de niveau invalide' });
    }
    
    if (sheetId && saEmail && saKey) {
      try {
        const client = buildSheetsClient();
        const themesRes = await client.spreadsheets.values.get({ 
          spreadsheetId: sheetId, 
          range: themesRange 
        });
        const themesRows = themesRes.data.values || [];
        let themes = themesRows.map(row => ({ 
          id: String(row[0] ?? '').trim(),
          idCategory: String(row[1] ?? '').trim(),
          idLevel: String(row[2] ?? '').trim(),
          name: String(row[3] ?? '').trim(),
          description: String(row[4] ?? '').trim()
        })).filter(t => t.id && t.idCategory && t.idLevel && t.name);
        
        if (!validateThemes(themes)) {
          logger.warn('DATA', 'Thèmes Sheets invalides, fallback JSON');
          throw new Error('Format invalide');
        }
        
        if (categoryId) {
          themes = themes.filter(t => String(t.idCategory) === String(categoryId));
        }

        if (levelId) {
          themes = themes.filter(t => String(t.idLevel) === String(levelId));
        }
        
        return res.json(themes);
      } catch (sheetsErr) {
        logger.warn('API', `Erreur Google Sheets thèmes, fallback JSON: ${sheetsErr.message}`);
      }
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

    if (levelId) {
      themes = themes.filter(t => String(t.idLevel) === String(levelId));
    }
    
    res.json(themes);
  } catch (err) {
    logger.error('API', `Erreur chargement thèmes: ${err.message}`);
    res.status(500).json({ error: 'Impossible de charger les thèmes' });
  }
});

router.get('/random', async (req, res) => {
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
    
    let questions = [];
    
    // Source des questions:
    // - Si Google Sheets est configuré, les questions DOIVENT venir du Sheet (pas de fallback silencieux).
    // - Sinon, fallback JSON local.
    const sheetsConfigured = Boolean(sheetId && saEmail && saKey);
    if (sheetsConfigured) {
      try {
        questions = await fetchQuestionsFromSheets();
      } catch (err) {
        logger.error('API', 'Erreur Google Sheets (questions requises depuis Sheets)', { error: err.message });
        return res.status(503).json({
          error: 'Impossible de charger les questions depuis Google Sheets',
          details: err.message
        });
      }
    } else {
      questions = loadQuestions();
    }
    
    // Filtrer selon les critères
    // Filtrer par matière via la catégorie
    if (matiereId) {
      if (sheetsConfigured) {
        // Les questions Sheets sont enrichies avec idMatiere lors du mapping
        questions = questions.filter(q => String(q.idMatiere || '') === String(matiereId));
      } else {
        // Mode JSON local: déduire la matière via categories.json
        const categoriesPath = path.join(__dirname, '..', 'data', 'categories.json');
        const categoriesJSON = fs.readFileSync(categoriesPath, 'utf-8');
        const categories = JSON.parse(categoriesJSON);
        const categoryIdsForMatiere = categories
          .filter(c => String(c.idMatiere) === String(matiereId))
          .map(c => String(c.id));
        
        questions = questions.filter(q => {
          const qCategoryId = String(q.idCategory || '');
          return categoryIdsForMatiere.includes(qCategoryId);
        });
      }
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

// Middleware d'erreur global (DOIT être à la fin)
router.use((err, req, res, next) => {
  logger.error('SERVER', `Erreur non gérée: ${err.message}`);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

module.exports = { router, setServer };
