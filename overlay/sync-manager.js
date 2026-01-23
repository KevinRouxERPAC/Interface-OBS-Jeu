/**
 * Synchronisation centralisée overlay ↔ admin
 * Supporte BroadcastChannel, localStorage et polling serveur
 */

class SyncManager {
  constructor(options = {}) {
    this.channelName = options.channelName || 'quiz-control';
    this.apiUrl = options.apiUrl || 'http://localhost:3000';
    this.apiKey = options.apiKey || '';
    this.pollInterval = options.pollInterval || 1000;
    this.logLevel = options.logLevel || 'info';
    
    this.channel = null;
    this.listeners = [];
    this.lastStateId = 0;
    this.lastCommandId = 0;
    this.pollingId = null;
  }

  /**
   * Initialise les canaux de synchronisation
   */
  init() {
    this.log('info', 'Initialisation SyncManager');
    this.initBroadcastChannel();
    this.initStorageListener();
    this.startPolling();
  }

  /**
   * Envoie une requête avec la clé API
   */
  async fetchWithApiKey(url, options = {}) {
    const headers = { ...options.headers };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return fetch(url, { ...options, headers });
  }

  /**
   * Initialise le canal BroadcastChannel
   */
  initBroadcastChannel() {
    if (!('BroadcastChannel' in window)) {
      this.log('warn', 'BroadcastChannel non disponible');
      return;
    }

    try {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        this.log('debug', 'Message reçu via BroadcastChannel', event.data);
        this.notifyListeners('message', event.data);
      };
      this.log('info', 'BroadcastChannel initialisé');
    } catch (err) {
      this.log('warn', 'Erreur BroadcastChannel', err.message);
    }
  }

  /**
   * Initialise l'écoute localStorage
   */
  initStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === 'quiz-state' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          this.log('debug', 'Message reçu via localStorage', data);
          this.notifyListeners('message', data);
        } catch (err) {
          this.log('error', 'Erreur parsing localStorage', err.message);
        }
      }
    });
  }

  /**
   * Démarre le polling serveur
   */
  startPolling() {
    this.pollingId = setInterval(() => this.pollServer(), this.pollInterval);
    this.log('info', `Polling serveur démarré (interval: ${this.pollInterval}ms)`);
  }

  /**
   * Poll le serveur pour nouvelles commandes/états
   */
  async pollServer() {
    try {
      const res = await this.fetchWithApiKey(`${this.apiUrl}/state`);
      if (!res.ok) return;
      
      const state = await res.json();
      if (!state || !state.timestamp) return;
      
      if (state.timestamp > this.lastStateId) {
        this.lastStateId = state.timestamp;
        this.log('debug', 'État reçu du serveur', state);
        this.notifyListeners('state', state);
      }
    } catch (err) {
      this.log('debug', 'Erreur polling serveur', err.message);
    }
  }

  /**
   * Envoie une commande
   */
  async sendCommand(cmd) {
    this.log('debug', 'Envoi commande', cmd);

    // Via BroadcastChannel
    if (this.channel) {
      this.channel.postMessage(cmd);
    } else {
      localStorage.setItem('quiz-command', JSON.stringify(cmd));
    }

    // Via serveur
    try {
      const res = await this.fetchWithApiKey(`${this.apiUrl}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
      });
      
      if (res.ok) {
        const data = await res.json();
        this.log('debug', 'Commande envoyée', { id: data.id });
        this.notifyListeners('command-sent', { ...cmd, id: data.id });
      }
    } catch (err) {
      this.log('error', 'Erreur envoi commande serveur', err.message);
    }
  }

  /**
   * Envoie un état
   */
  async sendState(state) {
    this.log('debug', 'Envoi état', state);

    // Via BroadcastChannel
    if (this.channel) {
      this.channel.postMessage({ type: 'STATE_UPDATE', ...state });
    } else {
      localStorage.setItem('quiz-state', JSON.stringify(state));
    }

    // Via serveur
    try {
      const res = await this.fetchWithApiKey(`${this.apiUrl}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      
      if (!res.ok) {
        this.log('warn', 'Erreur envoi état serveur', { status: res.status });
      }
    } catch (err) {
      this.log('error', 'Erreur envoi état serveur', err.message);
    }
  }

  /**
   * S'abonne aux messages de synchronisation
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifie tous les listeners
   */
  notifyListeners(type, data) {
    this.listeners.forEach(listener => {
      try {
        listener({ type, data });
      } catch (err) {
        this.log('error', 'Erreur dans listener', err.message);
      }
    });
  }

  /**
   * Logging
   */
  log(level, message, data) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[this.logLevel] >= levels[level]) {
      const msg = data ? `${message} ${JSON.stringify(data)}` : message;
      console.log(`[SyncManager] ${level.toUpperCase()}: ${msg}`);
    }
  }

  /**
   * Nettoyage
   */
  destroy() {
    if (this.pollingId) clearInterval(this.pollingId);
    if (this.channel) this.channel.close();
    this.listeners = [];
    this.log('info', 'SyncManager destroyed');
  }
}

// Export pour Node.js et navigateur
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncManager;
}
