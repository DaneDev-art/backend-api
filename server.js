// server.js (à la racine)
const app = require("./src/app");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_ATLAS_URI || "mongodb://127.0.0.1:27017/mydb";

// Connexion à MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log(`✅ MongoDB connecté : ${MONGO_URI}`))
  .catch(err => {
    console.error("❌ Erreur MongoDB:", err);
    process.exit(1);
  });

// Création du serveur HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // à adapter selon prod
    methods: ["GET", "POST"]
  }
});

io.on("connection", socket => {
  console.log("⚡ Nouveau client connecté:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client déconnecté:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Backend + Socket.IO démarré sur le port ${PORT}`);
  console.log("🌍 Environnement:", process.env.NODE_ENV || "development");
});
