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

// Page d'accueil
app.get("/", (req, res) => {
  res.send("Interface OBS Jeu - Serveur Render OK");
});

const server = app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// Permettre à l'API de fermer ce serveur (route /api/shutdown)
if (api.setServer) {
  api.setServer(server);
}
