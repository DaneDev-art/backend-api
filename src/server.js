require("dotenv").config();
const app = require("./app");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

// ✅ Import du routeur messages et fonction initSocket
const { router: messageRouter, initSocket } = require("./routes/messageRoutes");

const PORT = process.env.PORT || 5000;

// --- URI Mongo
const getMongoUri = () => {
  if (process.env.NODE_ENV === "production") return process.env.MONGO_ATLAS_URI;
  return process.env.MONGO_LOCAL_URI || process.env.MONGO_ATLAS_URI;
};

// --- Connexion Mongo avec retry
const connectDB = async (retries = 5, delay = 3000) => {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    console.error("❌ MongoDB URI non défini !");
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
      console.error("❌ Erreur MongoDB:", err.message);
      retries -= 1;
      if (!retries) process.exit(1);
      console.warn(`🔄 Nouvelle tentative dans ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

// --- Démarrage serveur
(async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    // --- Socket.IO
    const io = new Server(server, {
      cors: {
        origin:
          process.env.NODE_ENV === "production"
            ? ["https://ton-frontend.com", "https://backend-api-m0tf.onrender.com"]
            : "*",
        methods: ["GET", "POST", "PUT"],
      },
    });

    // Injection du socket dans les routes
    initSocket(io);

    // --- Utilisateurs en ligne
    const onlineUsers = new Map();

    io.on("connection", (socket) => {
      console.log("🔌 Client connecté :", socket.id);

      // 🔹 Rejoindre room utilisateur
      socket.on("join", (userId) => {
        if (userId) {
          socket.join(userId);
          onlineUsers.set(userId, socket.id);
          console.log(`👤 Utilisateur ${userId} a rejoint sa room`);
        }
      });

      // 🔹 Marquer les messages comme lus via socket
      socket.on("markAsRead", async ({ userId, otherUserId, productId }) => {
        try {
          const Message = require("./models/Message");
          await Message.updateMany(
            { from: otherUserId, to: userId, productId: productId || null, unread: userId },
            { $pull: { unread: userId } }
          );

          io.to(otherUserId).emit("message:read", { readerId: userId, otherUserId, productId });
        } catch (err) {
          console.error("❌ Erreur markAsRead socket:", err.message);
        }
      });

      // 🔹 Déconnexion
      socket.on("disconnect", () => {
        for (let [userId, id] of onlineUsers.entries()) {
          if (id === socket.id) {
            onlineUsers.delete(userId);
            console.log(`❌ Utilisateur ${userId} déconnecté`);
            break;
          }
        }
      });
    });

    // --- Routes messages
    app.use("/api/messages", messageRouter);

    // --- Démarrage serveur HTTP
    server.listen(PORT, () => {
      console.log(`✅ Backend + Socket.IO démarré sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`);
      console.log(`📦 Mongo URI utilisé: ${getMongoUri()}`);
    });
  } catch (err) {
    console.error("❌ Impossible de démarrer le serveur:", err.message);
    process.exit(1);
  }
})();
