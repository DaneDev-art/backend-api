require("dotenv").config();
const app = require("./app");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 5000;

// Déterminer l'URI Mongo à utiliser
const mongoUri =
  process.env.NODE_ENV === "production"
    ? process.env.MONGO_ATLAS_URI
    : process.env.MONGO_LOCAL_URI;

// Fonction pour connecter à MongoDB avec retries
const connectDB = async (retries = 5, delay = 3000) => {
  while (retries) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        dbName: process.env.MONGO_INITDB_DATABASE || "mydb",
      });
      console.log(`✅ MongoDB connecté : ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (err) {
      console.error("❌ Erreur de connexion MongoDB:", err.message);
      retries -= 1;

      if (!retries) {
        console.error("⛔ Impossible de se connecter à MongoDB, arrêt du serveur.");
        process.exit(1);
      }

      console.warn(`🔄 Nouvelle tentative de connexion dans ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

// Démarrage du serveur après connexion à MongoDB + Socket.IO
(async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: { origin: "*" }, // tu peux restreindre à ton frontend Flutter
    });

    io.on("connection", (socket) => {
      console.log("🔌 Nouvel utilisateur connecté :", socket.id);

      socket.on("joinRoom", (userId) => {
        socket.join(userId);
        console.log(`📥 Utilisateur ${userId} rejoint sa room`);
      });

      socket.on("sendMessage", async (data) => {
        const Message = require("./models/Message");
        const message = await Message.create({
          from: data.from,
          to: data.to,
          content: data.content,
        });

        // Notifier le destinataire en temps réel
        io.to(data.to).emit("receiveMessage", message);
      });

      socket.on("disconnect", () => {
        console.log("❌ Utilisateur déconnecté :", socket.id);
      });
    });

    server.listen(PORT, () => {
      console.log(`✅ Backend + Socket.IO démarré sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`);
      console.log(`📦 Mongo URI utilisé: ${mongoUri}`);
    });
  } catch (err) {
    console.error("❌ Impossible de démarrer le serveur:", err.message);
    process.exit(1);
  }
})();
