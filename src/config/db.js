const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Vérification des variables d'environnement
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("MONGO_ATLAS_URI:", process.env.MONGO_ATLAS_URI);
console.log("MONGO_LOCAL_URI:", process.env.MONGO_LOCAL_URI);
console.log("MONGO_INITDB_DATABASE:", process.env.MONGO_INITDB_DATABASE);

// Fonction de connexion
const connectDB = async (retries = 5, delay = 3000) => {
  const mongoUri =
    process.env.NODE_ENV === "production"
      ? process.env.MONGO_ATLAS_URI
      : process.env.MONGO_LOCAL_URI;

  if (!mongoUri) {
    logger.error("❌ MongoDB URI non défini ! Vérifie les variables d'environnement.");
    process.exit(1);
  }

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

module.exports = connectDB;
