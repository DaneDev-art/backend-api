// server.js

const server = require("./src/server"); // ton src/server.js
require("dotenv").config(); // Charger les variables d'environnement
const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    // ✅ Connexion à MongoDB
    await connectDB();

    // ✅ Démarrage du serveur
    app.listen(PORT, () => {
      console.log("====================================");
      console.log(`✅ Backend démarré sur le port: ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`);
      console.log(`📦 Mongo URI: ${process.env.MONGO_URI}`);
      console.log("====================================");
    });
  } catch (err) {
    console.error("❌ Impossible de démarrer le serveur:", err.message);
    process.exit(1); // Arrêt si MongoDB est inaccessible
  }
})();
