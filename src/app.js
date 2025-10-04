// =======================
// 📦 Import des modules
// =======================
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
app.use(helmet());           // Sécurise les headers HTTP
app.use(morgan("dev"));      // Affiche les requêtes dans la console

// Rate limiting : max 100 requêtes / 15 min par IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Trop de requêtes depuis cette IP, réessayez plus tard."
});
app.use(limiter);

// =======================
// 🔐 CORS : Flutter Web + API + Prod
// =======================
const allowedOriginsProd = [
  "https://mon-site.com",                     // Frontend production
  "https://backend-api-m0tf.onrender.com",   // Backend Render
];

app.use(cors({
  origin: function (origin, callback) {
    // Autoriser Postman, curl, ou Flutter Web sans header Origin
    if (!origin) return callback(null, true);

    // En production : n'autoriser que certaines origines
    if (process.env.NODE_ENV === "production") {
      if (allowedOriginsProd.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ [CORS PROD] Origine refusée :", origin);
        callback(new Error("Non autorisé par CORS en production"));
      }
    } else {
      // En dev : autoriser tout (Flutter Web, localhost, etc.)
      console.log("🔍 [CORS DEV] Autorisé :", origin);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// =======================
// 🧩 Middleware JSON
// =======================
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

// =======================
// 🚀 Export de l’app
// =======================
module.exports = app;
