const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Chemin des credentials : relatif au dossier server/ (ou à la racine du projet si "server/" dans le chemin)
const defaultCredentialsPath = path.join(__dirname, 'credentials', 'service-account.json');

function resolveCredentialsPath(envPath) {
  if (!envPath) return defaultCredentialsPath;
  if (path.isAbsolute(envPath)) return envPath;
  const normalized = envPath.replace(/^\.\//, '').replace(/\\/g, '/');
  // Si le chemin contient "server/", il est relatif à la racine du projet (parent de server/)
  if (normalized.startsWith('server/')) {
    return path.join(__dirname, '..', normalized);
  }
  return path.join(__dirname, normalized);
}

module.exports = {
  port: process.env.PORT || 3000,
  googleSheetsId: process.env.GOOGLE_SHEETS_ID || '',
  googleServiceAccountPath: resolveCredentialsPath(process.env.GOOGLE_SERVICE_ACCOUNT_PATH),
  cachePath: path.join(__dirname, 'cache', 'data-cache.json'),
  googleTimeout: parseInt(process.env.GOOGLE_TIMEOUT, 10) || 10000,
};
