// src/app.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

// Charger variables d’environnement
dotenv.config();

const app = express();

// =======================
// 🔐 Sécurité & logs
// =======================
app.use(helmet());           // Headers sécurisés
app.use(morgan("dev"));      // Logging des requêtes

// Rate limiting : max 100 requêtes / 15 min par IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Trop de requêtes depuis cette IP, réessayez plus tard."
});
app.use(limiter);

// =======================
// 🔐 CORS : Dev Web Flutter + prod
// =======================
const allowedOriginsProd = [
  "https://mon-site.com",                     // frontend prod
  "https://backend-api-m0tf.onrender.com",   // backend prod
  "http://localhost:5000",                    // backend dev local
  "http://localhost:5173",                    // Flutter Web dev port (change si différent)
];

app.use(cors({
  origin: function (origin, callback) {
    if (process.env.NODE_ENV === "production") {
      if (!origin || allowedOriginsProd.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("❌ Non autorisé par CORS en production : " + origin));
      }
    } else {
      console.log("🔍 [CORS DEV] Requête depuis:", origin || "origine inconnue");
      callback(null, true);
    }
  },
  credentials: true,
}));

// Middleware pour parser le JSON (avant les routes)
app.use(express.json());

// =======================
// 🔹 Routes principales
// =======================
const cinetpayRoutes = require("./routes/cinetpayRoutes");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");

app.use("/api/cinetpay", cinetpayRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

// =======================
// 🔹 Page d’accueil
// =======================
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Bienvenue sur l’API Marketplace",
    environment: process.env.NODE_ENV || "development",
    docs: "/api",
  });
});

// =======================
// 🔹 Health Check robuste
// =======================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "backend-api",
    environment: process.env.NODE_ENV || "development",
    mongo_uri: process.env.MONGO_ATLAS_URI ? "configured" : "not set",
    timestamp: new Date().toISOString(),
  });
});

// =======================
// 🔹 Gestion globale des erreurs
// =======================
app.use((err, req, res, next) => {
  if (err.message && err.message.includes("CORS")) {
    console.error("❌ [CORS ERROR]", err.message);
    return res.status(403).json({ error: err.message });
  }
  console.error("❌ [SERVER ERROR]", err);
  res.status(500).json({ error: "Une erreur est survenue sur le serveur" });
});

module.exports = app;
