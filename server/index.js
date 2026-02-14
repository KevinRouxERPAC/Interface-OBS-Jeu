/**
 * Point d'entrée du serveur - Overlay Interactif OBS
 * "Qui veut passer pour un teubé"
 */

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { GameEngine } = require('./services/game-engine');
const googleSheets = require('./services/google-sheets');
const cache = require('./services/cache');
const socketManager = require('./websocket/socket-manager');
const createDataRoutes = require('./routes/api-data');
const createGameRoutes = require('./routes/api-game');

// ─── Initialisation ─────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());

// ─── Instances ──────────────────────────────────────────────────
const gameEngine = new GameEngine();

// DataStore partagé (données en mémoire)
const dataStore = {
  questions: [],
  themes: [],
  categories: [],
  levels: [],
  matieres: [],
};

// ─── WebSocket ──────────────────────────────────────────────────
socketManager.init(server, gameEngine);

// ─── Routes API ─────────────────────────────────────────────────
app.use('/api/data', createDataRoutes({ dataStore, googleSheets, cache, socketManager }));
app.use('/api/game', createGameRoutes({ gameEngine, dataStore, socketManager }));

// ─── Fichiers statiques ─────────────────────────────────────────
const rootDir = path.join(__dirname, '..');

// Servir l'admin
app.use('/admin', express.static(path.join(rootDir, 'admin')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(rootDir, 'admin', 'index.html'));
});

// Servir l'overlay
app.use('/overlay', express.static(path.join(rootDir, 'overlay')));
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(rootDir, 'overlay', 'index.html'));
});

// Page d'accueil
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Qui veut passer pour un teubé - Serveur</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .container { text-align: center; background: #16213e; padding: 3rem; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        h1 { color: #e94560; margin-bottom: 0.5rem; }
        p { color: #aaa; margin-bottom: 2rem; }
        a { display: inline-block; margin: 0.5rem; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1rem; transition: transform 0.2s; }
        a:hover { transform: translateY(-2px); }
        .admin-link { background: #e94560; color: white; }
        .overlay-link { background: #0f3460; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Qui veut passer pour un teub&eacute;</h1>
        <p>Serveur local actif sur le port ${config.port}</p>
        <a href="/admin" class="admin-link">Interface Admin</a>
        <a href="/overlay" class="overlay-link">Overlay OBS</a>
      </div>
    </body>
    </html>
  `);
});

// ─── Chargement des données ─────────────────────────────────────
async function loadData() {
  console.log('─── Chargement des données ───');

  // Tenter Google Sheets
  if (config.googleSheetsId) {
    try {
      const initialized = await googleSheets.initClient();
      if (initialized) {
        const data = await googleSheets.loadAllData();
        const enriched = googleSheets.resolveRelations(data);
        Object.assign(dataStore, enriched);
        cache.saveCache(enriched);
        console.log('[Données] Chargées depuis Google Sheets');
        return;
      }
    } catch (err) {
      console.error('[Données] Erreur Google Sheets:', err.message);
    }
  } else {
    console.log('[Données] Pas d\'ID Google Sheets configuré, tentative de chargement du cache...');
  }

  // Fallback sur le cache
  const cached = cache.loadCache();
  if (cached && cached.data) {
    Object.assign(dataStore, cached.data);
    console.log(`[Données] Chargées depuis le cache (${cached.timestamp})`);
  } else {
    console.warn('[Données] Aucune donnée disponible. Configurez Google Sheets ou ajoutez un cache.');
  }
}

// ─── Arrêt propre du serveur ─────────────────────────────────────
function shutdown(signal) {
  const label = signal || 'shutdown';
  console.log('');
  console.log(`[Serveur] Signal ${label} reçu, arrêt en cours...`);
  server.close(() => {
    console.log('[Serveur] HTTP fermé');
    socketManager.close().then(() => {
      console.log('[Serveur] Arrêt terminé.');
      process.exit(0);
    });
  });
  // Forcer la sortie après 5 s si les callbacks ne se déclenchent pas
  setTimeout(() => {
    console.error('[Serveur] Timeout arrêt, sortie forcée.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Sur Windows : fermeture de la console (événement non standard)
process.on('exit', (code) => {
  if (code !== 0) return;
  console.log('[Serveur] Processus terminé.');
});

// ─── Démarrage ──────────────────────────────────────────────────
async function start() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Qui veut passer pour un teubé - Serveur   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  await loadData();

  server.listen(config.port, () => {
    console.log('');
    console.log(`──────────────────────────────────────────────`);
    console.log(`  Serveur démarré sur http://localhost:${config.port}`);
    console.log(`  Admin:   http://localhost:${config.port}/admin`);
    console.log(`  Overlay: http://localhost:${config.port}/overlay`);
    console.log(`──────────────────────────────────────────────`);
    console.log(`  Arrêt : Ctrl+C ou fermer cette console.`);
    console.log(`──────────────────────────────────────────────`);
    console.log('');
  });
}

start().catch(err => {
  console.error('Erreur fatale au démarrage:', err);
  process.exit(1);
});
