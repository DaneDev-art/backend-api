// =======================
// app.js
// =======================
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

// Charger variables d'environnement
dotenv.config();
const app = express();

// =======================
// 🔐 Sécurité & logs
// =======================
app.set("trust proxy", 1); // Corrige express-rate-limit derrière Render
app.use(helmet());
app.use(morgan("dev"));

// Limiteur de requêtes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: "Trop de requêtes depuis cette IP, réessayez plus tard.",
});
app.use(limiter);

// =======================
// 🌐 CORS Configuration
// =======================
const allowedOriginsProd = [
  "https://mon-site.com",
  "https://backend-api-m0tf.onrender.com",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Postman / mobile apps
    if (origin.startsWith("http://localhost:") || origin.startsWith("chrome-extension://")) {
      console.log("🔍 [CORS LOCAL DEV] Autorisé :", origin);
      return callback(null, true);
    }
    if (process.env.NODE_ENV === "production") {
      if (allowedOriginsProd.includes(origin)) return callback(null, true);
      console.warn("❌ [CORS PROD] Origine refusée :", origin);
      return callback(new Error("Non autorisé par CORS en production"));
    }
    console.log("🔍 [CORS DEV] Autorisé :", origin);
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// =======================
// 🧩 Middleware JSON
// =======================
app.use(express.json({ limit: "10mb" }));

// =======================
// 🔹 Routes principales
// =======================
app.use("/api/cinetpay", require("./routes/cinetpayRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));

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
// 🔹 Health Check
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

// =======================
// 🚀 Export de l’app
// =======================
module.exports = app;
