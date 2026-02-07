const express = require("express");
const path = require("path");
const app = express();

const PORT = process.env.PORT || 3000;

// Servir l'overlay
app.use("/overlay", express.static(path.join(__dirname, "overlay")));

// Servir l'admin
app.use("/admin", express.static(path.join(__dirname, "admin")));

// Charger l'API
const api = require("./api/server");
app.use("/api", api.router);

// Page d'accueil : liens vers les deux interfaces (avec clé API optionnelle en prod)
app.get("/", (req, res) => {
  res.type("html").send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Interface OBS Jeu</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 1.5rem; }
    .key-row { margin-bottom: 1rem; }
    .key-row label { display: block; font-size: 0.875rem; color: #888; margin-bottom: 0.25rem; }
    .key-row input { width: 100%; padding: 0.5rem; box-sizing: border-box; border-radius: 6px; border: 1px solid #333; background: #1a1a2e; color: #eee; }
    .key-row input::placeholder { color: #666; }
    a { display: block; padding: 1rem; margin: 0.5rem 0; background: #1a1a2e; color: #eee; text-decoration: none; border-radius: 8px; text-align: center; }
    a:hover { background: #16213e; }
    .hint { font-size: 0.75rem; color: #666; margin-top: 0.25rem; }
  </style>
</head>
<body>
  <h1>Interface OBS Jeu</h1>
  <div class="key-row">
    <label for="api-key">Clé API (requis en production)</label>
    <input type="password" id="api-key" placeholder="Collez la même clé que sur le serveur" autocomplete="off">
    <p class="hint">Saisissez-la puis ouvrez les pages ci-dessous : elle sera transmise à l'admin et à l'overlay.</p>
  </div>
  <a href="/admin" id="link-admin">Panneau d'administration</a>
  <a href="/overlay" id="link-overlay">Overlay OBS (aperçu)</a>
  <script>
    (function() {
      var input = document.getElementById('api-key');
      var linkAdmin = document.getElementById('link-admin');
      var linkOverlay = document.getElementById('link-overlay');
      function updateLinks() {
        var key = (input && input.value || '').trim();
        var q = key ? '?apiKey=' + encodeURIComponent(key) : '';
        linkAdmin.href = '/admin' + q;
        linkOverlay.href = '/overlay' + q;
      }
      if (input) {
        input.addEventListener('input', updateLinks);
        input.addEventListener('change', updateLinks);
        var stored = localStorage.getItem('quiz-api-key');
        if (stored) { input.value = stored; updateLinks(); }
      }
    })();
  </script>
</body>
</html>
  `);
});

const server = app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// Permettre à l'API de fermer ce serveur (route /api/shutdown)
if (api.setServer) {
  api.setServer(server);
}
