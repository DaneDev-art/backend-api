// =======================
// src/app.js
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
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));

// 🔒 Limiteur de requêtes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Trop de requêtes depuis cette IP, réessayez plus tard.",
  },
});
app.use(limiter);

// =======================
// 🌐 CORS Configuration
// =======================
const allowedOriginsProd = [
  "https://mon-site.com",
  "https://backend-api-m0tf.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      // Dev local
      if (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("chrome-extension://")
      ) {
        console.log("🔍 [CORS LOCAL DEV] Autorisé :", origin);
        return callback(null, true);
      }

      // Production
      if (process.env.NODE_ENV === "production") {
        if (allowedOriginsProd.includes(origin)) {
          console.log("✅ [CORS PROD] Origine autorisée :", origin);
          return callback(null, true);
        }
        console.warn("❌ [CORS PROD] Origine refusée :", origin);
        return callback(new Error("Origine non autorisée par CORS"));
      }

      console.log("🔍 [CORS DEV] Autorisé :", origin);
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// =======================
// 🧩 Middleware JSON
// =======================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// =======================
// 🔹 Routes principales
// =======================

// Auth
app.use("/api/auth", require("./routes/authRoutes"));

// Users
app.use("/api/users", require("./routes/users.routes"));

// Sellers
app.use("/api/sellers", require("./routes/seller.routes"));

// Paiement CinetPay
app.use("/api/cinetpay", require("./routes/cinetpayRoutes"));

// Marketplace
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/upload", require("./routes/uploadRoutes"));

// Deliveries
app.use("/api/deliveries", require("./routes/deliveries"));

// =======================
// 🚚 DELIVERY ASSIGNMENTS (corrigé)
// =======================
// ⚠️ IMPORTANT : cohérent avec Flutter : /api/delivery-assignments
app.use("/api/delivery-assignments", require("./routes/deliveryAssignments"));

// Messages
const { router: messageRoutes } = require("./routes/messageRoutes");
app.use("/api/messages", messageRoutes);

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
    return res.status(403).json({ success: false, error: err.message });
  }

  console.error("❌ [SERVER ERROR]", err);
  res.status(500).json({
    success: false,
    error: "Une erreur interne est survenue sur le serveur",
  });
});

// =======================
// 🚀 Export
// =======================
module.exports = app;
