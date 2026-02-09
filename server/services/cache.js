/**
 * Cache Service - Gestion du cache local JSON
 * Permet le fonctionnement hors-ligne si Google Sheets est inaccessible.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Sauvegarde les données dans le fichier de cache local
 * @param {object} data - Données structurées (questions, themes, categories, levels, matieres)
 */
function saveCache(data) {
  try {
    const cacheDir = path.dirname(config.cachePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cacheData = {
      timestamp: new Date().toISOString(),
      data,
    };

    fs.writeFileSync(config.cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log(`[Cache] Données sauvegardées (${new Date().toLocaleString()})`);
    return true;
  } catch (err) {
    console.error('[Cache] Erreur lors de la sauvegarde:', err.message);
    return false;
  }
}

/**
 * Charge les données depuis le fichier de cache local
 * @returns {{ timestamp: string, data: object } | null}
 */
function loadCache() {
  try {
    if (!fs.existsSync(config.cachePath)) {
      console.log('[Cache] Aucun fichier de cache trouvé');
      return null;
    }

    const raw = fs.readFileSync(config.cachePath, 'utf-8');
    const cacheData = JSON.parse(raw);
    console.log(`[Cache] Données chargées depuis le cache (${cacheData.timestamp})`);
    return cacheData;
  } catch (err) {
    console.error('[Cache] Erreur lors du chargement:', err.message);
    return null;
  }
}

/**
 * Vérifie si un cache existe
 * @returns {boolean}
 */
function cacheExists() {
  return fs.existsSync(config.cachePath);
}

/**
 * Retourne les informations du cache (timestamp, existence)
 */
function getCacheInfo() {
  if (!cacheExists()) {
    return { exists: false, timestamp: null };
  }

  try {
    const raw = fs.readFileSync(config.cachePath, 'utf-8');
    const cacheData = JSON.parse(raw);
    return { exists: true, timestamp: cacheData.timestamp };
  } catch {
    return { exists: false, timestamp: null };
  }
}

module.exports = { saveCache, loadCache, cacheExists, getCacheInfo };
