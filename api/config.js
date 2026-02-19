/**
 * Configuration centralisée de l'API
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  // Serveur
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',

  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim()),

  // Google Sheets (base de données : importée en JSON locaux à chaque démarrage)
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
  if (!config.allowedOrigins.length) {
    config.allowedOrigins = ['http://localhost:3000'];
  }
}

validate();

module.exports = config;
