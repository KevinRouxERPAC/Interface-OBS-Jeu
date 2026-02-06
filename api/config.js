/**
 * Configuration centralisée de l'API
 */

require('dotenv').config();

const config = {
  // Serveur
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',

  // Authentification
  apiKey: process.env.API_KEY,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim()),

  // Google Sheets (optionnel)
  googleSheets: {
    id: process.env.GOOGLE_SHEETS_ID,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    ranges: {
      // Nouveau MLD:
      // - Questions: ID, IDTheme, Question, Right_Answer, Prop1..3, Explications, Type_Question (A..I)
      // - Theme: ID, IDCategory, IDLevel, Name, Description (A..E)
      // On garde une compat serveur (l'API tolère l'ancien format Questions avec IDLevel en colonne C).
      questions: process.env.GOOGLE_SHEETS_QUESTIONS_RANGE || 'Questions!A2:I',
      themes: process.env.GOOGLE_SHEETS_THEMES_RANGE || 'Theme!A2:E',
      categories: process.env.GOOGLE_SHEETS_CATEGORIES_RANGE || 'Category!A2:E',
      levels: process.env.GOOGLE_SHEETS_LEVELS_RANGE || 'Level!A2:B',
      matieres: process.env.GOOGLE_SHEETS_MATIERES_RANGE || 'Matiere!A2:B'
    }
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Validation
function validate() {
  if (config.isProduction && !config.apiKey) {
    console.warn('[config] API_KEY non définie en production : définir fly secrets set API_KEY=... puis redéployer pour sécuriser l’API.');
  }
  const origins = (process.env.ALLOWED_ORIGINS || '').trim();
  if (!origins && config.isProduction) {
    console.warn('[config] ALLOWED_ORIGINS non défini : définir fly secrets set ALLOWED_ORIGINS=https://votre-app.fly.dev,... pour le CORS.');
  }
  if (!config.allowedOrigins.length) {
    config.allowedOrigins = ['http://localhost:3000'];
  }
}

validate();

module.exports = config;
