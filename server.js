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

// Page d'accueil : liens vers les deux interfaces
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
    a { display: block; padding: 1rem; margin: 0.5rem 0; background: #1a1a2e; color: #eee; text-decoration: none; border-radius: 8px; }
    a:hover { background: #16213e; }
  </style>
</head>
<body>
  <h1>Interface OBS Jeu</h1>
  <a href="/admin">Panneau d’administration</a>
  <a href="/overlay">Overlay OBS (aperçu)</a>
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
