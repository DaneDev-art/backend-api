const mongoose = require("mongoose");
const logger = require("../utils/logger");

/**
 * Connecte à MongoDB avec retries en cas d'échec.
 * @param {number} retries - Nombre de tentatives de connexion restantes (par défaut 5)
 * @param {number} delay - Délai entre les tentatives en ms (par défaut 3000)
 */
const connectDB = async (retries = 5, delay = 3000) => {
  // Choisir l'URI en fonction de l'environnement
  const mongoUri =
    process.env.NODE_ENV === "production"
      ? process.env.MONGO_ATLAS_URI
      : process.env.MONGO_LOCAL_URI;

  while (retries) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        dbName: process.env.MONGO_INITDB_DATABASE || "mydb",
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      logger.info(
        `✅ MongoDB connecté : ${conn.connection.host}/${conn.connection.name}`
      );
      return conn;
    } catch (error) {
      logger.error("❌ Erreur de connexion MongoDB:", error.message);
      retries -= 1;

      if (!retries) {
        logger.error("⛔ Impossible de se connecter à MongoDB, arrêt du serveur.");
        process.exit(1);
      }

      logger.warn(`🔄 Nouvelle tentative de connexion dans ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

// ✅ Export de la fonction
module.exports = connectDB;
