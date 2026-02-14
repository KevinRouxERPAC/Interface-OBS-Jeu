/**
 * Socket Manager - Gestion des connexions WebSocket via Socket.IO
 */

const { Server } = require('socket.io');

let io = null;

/**
 * Initialise le serveur Socket.IO
 * @param {import('http').Server} httpServer
 * @param {import('../services/game-engine').GameEngine} gameEngine
 */
function init(httpServer, gameEngine) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Client connecté: ${socket.id}`);

    // Envoyer l'état courant au nouveau client
    socket.emit('game:state-update', gameEngine.getState());

    // Le client demande l'état courant (resynchronisation)
    socket.on('request:state', () => {
      socket.emit('game:state-update', gameEngine.getState());
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client déconnecté: ${socket.id}`);
    });
  });

  console.log('[WS] Socket.IO initialisé');
  return io;
}

/**
 * Diffuse un événement à tous les clients connectés
 * @param {string} event
 * @param {*} data
 */
function broadcast(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Diffuse l'état complet du jeu à tous les clients
 * @param {object} state
 */
function broadcastState(state) {
  broadcast('game:state-update', state);
}

/**
 * Ferme proprement le serveur Socket.IO (pour arrêt du serveur)
 * @returns {Promise<void>}
 */
function close() {
  if (io) {
    return new Promise((resolve) => {
      io.close(() => {
        io = null;
        console.log('[WS] Socket.IO fermé');
        resolve();
      });
    });
  }
  return Promise.resolve();
}

module.exports = { init, broadcast, broadcastState, close };
