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
      questions: process.env.GOOGLE_SHEETS_QUESTIONS_RANGE || 'Questions!A2:J',
      themes: process.env.GOOGLE_SHEETS_THEMES_RANGE || 'Theme!A2:D',
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
    throw new Error('API_KEY est requise en production');
  }
  if (!config.allowedOrigins.length) {
    throw new Error('ALLOWED_ORIGINS ne peut pas être vide');
  }
}

validate();

module.exports = config;
