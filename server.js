// server.js (racine)
const path = require("path");

// Pour charger les variables d'environnement
require("dotenv").config();

// Importer ton serveur HTTP complet (Express + Socket.IO) depuis src/server.js
require(path.join(__dirname, "src", "server"));

// --- Infos de log pour confirmation que le fichier racine a été exécuté
console.log("🚀 server.js racine chargé");
console.log(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`);
console.log(`📦 Port configuré dans .env: ${process.env.PORT || 5000}`);
