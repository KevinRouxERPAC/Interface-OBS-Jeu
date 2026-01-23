require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;
const questionsPath = path.join(__dirname, '..', 'data', 'questions.json');
const sheetId = process.env.GOOGLE_SHEETS_ID;
const questionsRange = process.env.GOOGLE_SHEETS_QUESTIONS_RANGE || 'Questions!A2:J';
const themesRange = process.env.GOOGLE_SHEETS_THEMES_RANGE || 'Theme!A2:D';
const categoriesRange = process.env.GOOGLE_SHEETS_CATEGORIES_RANGE || 'Category!A2:E';
const levelsRange = process.env.GOOGLE_SHEETS_LEVELS_RANGE || 'Level!A2:B';
const matieresRange = process.env.GOOGLE_SHEETS_MATIERES_RANGE || 'Matiere!A2:B';
const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

let lastCommand = { id: 0, cmd: null };
let overlayState = { question: null, timer: null, selectedIndex: null, timestamp: 0 };

// Configuration CORS plus permissive pour OBS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Cache-Control'],
  credentials: false
};

app.use(cors(corsOptions));
app.use(express.json());

// Servir les fichiers statiques
app.use('/overlay', express.static(path.join(__dirname, '..', 'overlay')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

// Command bus simple (fallback pour OBS ou navigateurs sans BroadcastChannel partagé)
app.post('/command', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Commande invalide' });
  }
  lastCommand = { id: lastCommand.id + 1, cmd: req.body };
  res.json({ ok: true, id: lastCommand.id });
});

app.get('/command', (_req, res) => {
  res.json(lastCommand);
});

// État de l'overlay (utilisé par admin pour afficher l'état)
app.post('/state', (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: 'État invalide' });
  }
  overlayState = { ...req.body, timestamp: Date.now() };
  res.json({ ok: true });
});

app.get('/state', (_req, res) => {
  res.json(overlayState);
});


let sheetsClient = null;

function loadQuestions() {
  const raw = fs.readFileSync(questionsPath, 'utf-8');
  return JSON.parse(raw);
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
      return res.json(levels);
    }
    // Fallback JSON local
    const levelsJSON = fs.readFileSync(path.join(__dirname, '..', 'data', 'levels.json'), 'utf-8');
    const levels = JSON.parse(levelsJSON);
    res.json(levels);
  } catch (err) {
    console.error(err);
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
      return res.json(categories);
    }
    // Fallback JSON local
    const categoriesJSON = fs.readFileSync(path.join(__dirname, '..', 'data', 'categories.json'), 'utf-8');
    const categories = JSON.parse(categoriesJSON);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Impossible de charger les catégories' });
  }
});

app.get('/themes', async (req, res) => {
  try {
    const categoryId = req.query.categoryId;
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
      
      if (categoryId) {
        themes = themes.filter(t => t.idCategory === categoryId);
      }
      
      return res.json(themes);
    }
    // Fallback JSON local
    const themesJSON = fs.readFileSync(path.join(__dirname, '..', 'data', 'themes.json'), 'utf-8');
    let themes = JSON.parse(themesJSON);
    
    if (categoryId) {
      themes = themes.filter(t => t.idCategory === categoryId);
    }
    
    res.json(themes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Impossible de charger les thèmes' });
  }
});

app.get('/random', async (req, res) => {
  try {
    const { levelId, categoryId, themeId } = req.query;
    
    // Priorité Sheets si configuré
    if (sheetId && saEmail && saKey) {
      let questions = await fetchQuestionsFromSheets();
      
      // Filtrer selon les critères
      if (levelId) {
        questions = questions.filter(q => {
          // Récupérer l'ID du niveau depuis le nom
          return q.niveau === levelId || q.idLevel === levelId;
        });
      }
      
      if (categoryId) {
        questions = questions.filter(q => q.idCategory === categoryId);
      }
      
      if (themeId) {
        questions = questions.filter(q => q.idTheme === themeId);
      }
      
      if (!questions.length) {
        return res.status(404).json({ error: 'Aucune question trouvée avec ces critères' });
      }
      
      return res.json(pickRandom(questions));
    }

    // Fallback JSON local
    const questions = loadQuestions();
    return res.json(pickRandom(questions));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Impossible de charger les questions' });
  }
});

app.listen(PORT, () => {
  console.log(`API quiz démarrée sur http://localhost:${PORT}`);
});
