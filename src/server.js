// server.js à la racine
require("dotenv").config();
const app = require("./app"); // ton fichier app.js où sont définies les routes
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const PORT = process.env.PORT || 5000;

// --- Faire confiance aux proxies (Render, Nginx, etc.)
app.set("trust proxy", 1); // 1 = confiance au premier proxy

// --- Middleware pour parser le JSON et limiter la taille du body
app.use(express.json({ limit: '10mb' }));

// --- CORS pour Express
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? ["https://ton-frontend.com"] // ton frontend prod
    : "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// --- Déterminer l'URI Mongo
const getMongoUri = () => {
  if (process.env.NODE_ENV === "production") {
    return process.env.MONGO_ATLAS_URI;
  }
  // fallback si pas de MONGO_LOCAL_URI défini
  return process.env.MONGO_LOCAL_URI || process.env.MONGO_ATLAS_URI;
};

// --- Fonction pour connecter à MongoDB avec retries
const connectDB = async (retries = 5, delay = 3000) => {
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    console.error("❌ MongoDB URI non défini ! Vérifie les variables d'environnement.");
    process.exit(1);
  }

  while (retries) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        dbName: process.env.MONGO_INITDB_DATABASE || "mydb",
        useNewUrlParser: true,
        useUnifiedTopology: true,
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

// --- Démarrage serveur après connexion à MongoDB
(async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    // Socket.IO
    const io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === "production"
          ? ["https://ton-frontend.com", "https://backend-api-m0tf.onrender.com"]
          : "*",
        methods: ["GET", "POST"]
      }
    });

    io.on("connection", (socket) => {
      console.log("🔌 Nouvel utilisateur connecté :", socket.id);

      socket.on("joinRoom", (userId) => {
        socket.join(userId);
        console.log(`📥 Utilisateur ${userId} rejoint sa room`);
      });

      socket.on("sendMessage", async (data) => {
        const Message = require("./src/models/Message");
        const message = await Message.create({
          from: data.from,
          to: data.to,
          content: data.content,
        });
        io.to(data.to).emit("receiveMessage", message);
      });

      socket.on("disconnect", () => {
        console.log("❌ Utilisateur déconnecté :", socket.id);
      });
    });

    server.listen(PORT, () => {
      const mongoUri = getMongoUri();
      console.log(`✅ Backend + Socket.IO démarré sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`);
      console.log(`📦 Mongo URI utilisé: ${mongoUri}`);
    });
  } catch (err) {
    console.error("❌ Impossible de démarrer le serveur:", err.message);
    process.exit(1);
  }
})();
