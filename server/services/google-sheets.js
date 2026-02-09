/**
 * Google Sheets Service - Lecture des données depuis Google Sheets
 * Utilise un compte de service pour l'authentification.
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let sheetsClient = null;
let lastLoadTimestamp = null;
let connectionStatus = 'disconnected'; // 'connected', 'disconnected', 'error'
let lastError = null;

/**
 * Initialise le client Google Sheets
 */
async function initClient() {
  try {
    const credPath = path.resolve(config.googleServiceAccountPath);

    if (!fs.existsSync(credPath)) {
      throw new Error(`Fichier de credentials introuvable: ${credPath}`);
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    connectionStatus = 'connected';
    lastError = null;
    console.log('[Google Sheets] Client initialisé avec succès');
    return true;
  } catch (err) {
    connectionStatus = 'error';
    lastError = err.message;
    console.error('[Google Sheets] Erreur d\'initialisation:', err.message);
    return false;
  }
}

/**
 * Lit les données d'un onglet spécifique
 * @param {string} sheetName - Nom de l'onglet
 * @returns {Array<object>}
 */
async function readSheet(sheetName) {
  if (!sheetsClient) {
    throw new Error('Client Google Sheets non initialisé');
  }

  const response = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.warn(`[Google Sheets] Onglet "${sheetName}" vide`);
    return [];
  }

  // Première ligne = en-têtes
  const headers = rows[0];
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const obj = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = row[index] !== undefined ? row[index].trim() : '';
    });

    // Valider que l'ID existe
    if (obj.ID && obj.ID !== '') {
      // Convertir l'ID en nombre
      obj.ID = parseInt(obj.ID, 10);
      if (isNaN(obj.ID)) {
        console.warn(`[Google Sheets] ID invalide ligne ${i + 1} dans "${sheetName}", ignorée`);
        continue;
      }
      data.push(obj);
    }
  }

  return data;
}

/**
 * Charge toutes les données depuis Google Sheets
 * @returns {object} { questions, themes, categories, levels, matieres }
 */
async function loadAllData() {
  console.log('[Google Sheets] Chargement des données...');

  const [questions, themes, categories, levels, matieres] = await Promise.all([
    readSheet('Questions'),
    readSheet('Theme'),
    readSheet('Category'),
    readSheet('Level'),
    readSheet('Matiere'),
  ]);

  // Convertir les clés étrangères en nombres
  questions.forEach(q => {
    q.IDTheme = parseInt(q.IDTheme, 10) || 0;
  });

  themes.forEach(t => {
    t.IDCategory = parseInt(t.IDCategory, 10) || 0;
    t.IDLevel = parseInt(t.IDLevel, 10) || 0;
  });

  categories.forEach(c => {
    c.IDMatiere = parseInt(c.IDMatiere, 10) || 0;
  });

  lastLoadTimestamp = new Date().toISOString();
  connectionStatus = 'connected';
  lastError = null;

  console.log(`[Google Sheets] Chargé: ${questions.length} questions, ${themes.length} thèmes, ${categories.length} catégories, ${levels.length} niveaux, ${matieres.length} matières`);

  return { questions, themes, categories, levels, matieres };
}

/**
 * Résout les relations entre les tables et enrichit les questions
 * @param {object} data - { questions, themes, categories, levels, matieres }
 * @returns {object} - Données enrichies
 */
function resolveRelations(data) {
  const { questions, themes, categories, levels, matieres } = data;

  // Créer des maps pour les lookups
  const themeMap = new Map(themes.map(t => [t.ID, t]));
  const categoryMap = new Map(categories.map(c => [c.ID, c]));
  const levelMap = new Map(levels.map(l => [l.ID, l]));
  const matiereMap = new Map(matieres.map(m => [m.ID, m]));

  // Enrichir les thèmes
  themes.forEach(theme => {
    const category = categoryMap.get(theme.IDCategory);
    const level = levelMap.get(theme.IDLevel);
    theme.categoryName = category ? category.Name : '';
    theme.levelName = level ? level.Libel : '';
    if (category) {
      const matiere = matiereMap.get(category.IDMatiere);
      theme.matiereName = matiere ? matiere.Nom : '';
    } else {
      theme.matiereName = '';
    }
  });

  // Enrichir les questions
  questions.forEach(question => {
    const theme = themeMap.get(question.IDTheme);
    if (theme) {
      question.themeName = theme.Name;
      question.levelName = theme.levelName;
      question.categoryName = theme.categoryName;
      question.matiereName = theme.matiereName;
    } else {
      question.themeName = '';
      question.levelName = '';
      question.categoryName = '';
      question.matiereName = '';
    }
  });

  return data;
}

/**
 * Retourne le statut de la connexion Google Sheets
 */
function getStatus() {
  return {
    status: connectionStatus,
    lastLoad: lastLoadTimestamp,
    lastError,
  };
}

module.exports = { initClient, loadAllData, resolveRelations, getStatus };
