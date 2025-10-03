// server.js (racine)
const path = require("path");

// Pour charger les variables d'environnement
require("dotenv").config();

// Importer ton serveur Express depuis src/server.js
const app = require(path.join(__dirname, "src", "server"));

// Définir le port depuis l'environnement ou 5000 par défaut
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Backend + Socket.IO démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`);
});
