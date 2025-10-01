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
// 🔐 CORS : Restriction
// =======================
const allowedOrigins = [
  "http://localhost:3000",   // ✅ frontend en développement
  "https://mon-site.com",    // ✅ frontend en production
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("❌ Non autorisé par CORS"));
    }
  },
  credentials: true,
}));

// Middleware pour parser le JSON
app.use(express.json());

// =======================
// 🔹 Routes principales
// =======================
const cinetpayRoutes = require("./routes/cinetpayRoutes");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart"); // 🔹 Nouvelle route Cart

app.use("/api/cinetpay", cinetpayRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes); // 🔹 Monter les routes du panier

// =======================
// 🔹 Page d’accueil (évite le 404)
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
  if (err.message === "❌ Non autorisé par CORS") {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Une erreur est survenue" });
});

module.exports = app;
