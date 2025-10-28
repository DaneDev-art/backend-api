// =======================
// src/server.js
// =======================
require("dotenv").config();
const app = require("./app");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const chalk = require("chalk"); // 🌈 Pour les logs colorés

// ✅ Import fonction initSocket
const { initSocket } = require("./routes/messageRoutes");

const PORT = process.env.PORT || 5000;

// =======================
// 🔹 Connexion MongoDB
// =======================
const getMongoUri = () => {
  if (process.env.NODE_ENV === "production") return process.env.MONGO_ATLAS_URI;
  return process.env.MONGO_LOCAL_URI || process.env.MONGO_ATLAS_URI;
};

const connectDB = async (retries = 5, delay = 3000) => {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    console.log(chalk.red("❌ MongoDB URI non défini !"));
    process.exit(1);
  }

  while (retries) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        dbName: process.env.MONGO_INITDB_DATABASE || "mydb",
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      console.log(
        chalk.greenBright("✅ MongoDB connecté :"),
        chalk.cyan(`${conn.connection.host}/${conn.connection.name}`)
      );
      return conn;
    } catch (err) {
      console.log(chalk.red("❌ Erreur MongoDB:"), chalk.yellow(err.message));
      retries -= 1;
      if (!retries) process.exit(1);
      console.log(
        chalk.yellow(`🔄 Nouvelle tentative dans ${delay / 1000}s... (${retries} restantes)`)
      );
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

// =======================
// 🚀 Lancement du serveur
// =======================
(async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    // --- Initialisation Socket.IO
    const io = new Server(server, {
      cors: {
        origin:
          process.env.NODE_ENV === "production"
            ? [
                "https://ton-frontend.com",
                "https://backend-api-m0tf.onrender.com",
              ]
            : "*",
        methods: ["GET", "POST", "PUT"],
      },
    });

    // --- Injection socket pour la messagerie
    initSocket(io);

    const onlineUsers = new Map();

    io.on("connection", (socket) => {
      console.log(chalk.blueBright(`🔌 Client connecté : ${socket.id}`));

      socket.on("join", (userId) => {
        if (userId) {
          socket.join(userId);
          onlineUsers.set(userId, socket.id);
          console.log(chalk.magenta(`👤 Utilisateur ${userId} a rejoint sa room`));
        }
      });

      socket.on("markAsRead", async ({ userId, otherUserId, productId }) => {
        try {
          const Message = require("./models/Message");
          await Message.updateMany(
            { from: otherUserId, to: userId, productId: productId || null, unread: userId },
            { $pull: { unread: userId } }
          );

          io.to(otherUserId).emit("message:read", {
            readerId: userId,
            otherUserId,
            productId,
          });
        } catch (err) {
          console.log(chalk.red("❌ Erreur markAsRead socket:"), chalk.yellow(err.message));
        }
      });

      socket.on("disconnect", () => {
        for (let [userId, id] of onlineUsers.entries()) {
          if (id === socket.id) {
            onlineUsers.delete(userId);
            console.log(chalk.gray(`❌ Utilisateur ${userId} déconnecté`));
            break;
          }
        }
      });
    });

    // --- Démarrage serveur HTTP
    server.listen(PORT, () => {
      console.log(chalk.green("\n=============================="));
      console.log(chalk.bold("🚀 Serveur Marketplace démarré"));
      console.log(chalk.green("=============================="));
      console.log(`${chalk.yellow("Port :")} ${chalk.cyan(PORT)}`);
      console.log(`${chalk.yellow("Environnement :")} ${chalk.cyan(process.env.NODE_ENV || "development")}`);
      console.log(`${chalk.yellow("Mongo URI :")} ${chalk.cyan(getMongoUri())}`);
      console.log(`${chalk.yellow("📡 Socket.IO :")} ${chalk.greenBright("activé")}`);
      console.log(chalk.green("==============================\n"));
    });
  } catch (err) {
    console.log(chalk.red("❌ Impossible de démarrer le serveur:"), chalk.yellow(err.message));
    process.exit(1);
  }
})();
