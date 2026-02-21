// =======================
// src/app.js
// =======================
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const emailRoutes = require("./routes/emailRoutes");
const deployAuth = require("./middleware/deployAuth");
const customOrderRoutes = require("./routes/customOrder.routes");

// 🔹 CORS middleware centralisé (frontend)
const corsOptions = require("./middleware/cors.middleware");

// 🔹 GitHub App
const { getGithubClient } = require("./githubClient");

// 🔹 QOSPAY routes
const qospayRoutes = require("./routes/qospay.routes");

// Charger variables d'environnement
dotenv.config();
const app = express();

// =======================
// 🔐 Sécurité & logs
// =======================
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));

// =======================
// 🔒 Limiteur de requêtes
// =======================
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: "Trop de requêtes depuis cette IP, réessayez plus tard.",
    },
  })
);

// =======================
// 🧩 Middleware JSON
// =======================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ==================================================
// 💳 CINETPAY — AVANT LE CORS GLOBAL (CRITIQUE)
// ==================================================
// Server-to-server → AUCUNE restriction CORS
app.use("/api/cinetpay", cors({ origin: true }));
app.use("/api/cinetpay", require("./routes/cinetpayRoutes"));

// ==================================================
// 💳 QOSPAY — AVANT LE CORS GLOBAL (CRITIQUE)
// ==================================================
// Server-to-server → AUCUNE restriction CORS
app.use("/api/qospay", cors({ origin: true }));
app.use("/api/qospay", qospayRoutes);

// =======================
// 🌐 CORS GLOBAL (Frontend uniquement)
// =======================
app.use(cors(corsOptions));

// =======================
// 🔹 Routes principales
// =======================

// 🔐 Auth
app.use("/api/auth", require("./routes/authRoutes"));

// 👤 Users
app.use("/api/users", require("./routes/users.routes"));

// 🏪 Sellers
app.use("/api/sellers", require("./routes/seller.routes"));

// 🛒 Orders
app.use("/api/orders", require("./routes/order.routes"));

//CustomOrder
app.use("/api/custom-orders", customOrderRoutes);

// 📧 Email
app.use("/api/email", emailRoutes);

// Transactions
app.use("/api", require("./routes/me.routes"));

// 🛍️ Marketplace
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/upload", require("./routes/uploadRoutes"));

// 🚚 Deliveries
app.use("/api/deliveries", require("./routes/deliveries"));

// 🚚 Delivery Assignments
app.use(
  "/api/delivery-assignments",
  require("./routes/deliveryAssignments")
);

// 💬 Messages
const messageRoutes = require("./routes/messageRoutes");
app.use("/api/messages", messageRoutes.router);

// 💰 Wallet
const walletRoutes = require("./routes/wallet.routes");
app.use("/api/wallet", walletRoutes);

// 🔗 Referral
const referralRoutes = require("./routes/referral.routes");
app.use("/api/referral", referralRoutes);
app.use("/api/referrals", referralRoutes);

// ==================================================
// 🔔 WEBHOOKS (QOSPAY & CINETPAY)
// ==================================================

// QOSPay webhook
app.use("/api/webhooks/qospay", require("./routes/webhooks/qospay.webhook"));

// CinetPay webhook
app.use(
  "/api/webhooks/cinetpay",
  require("./routes/webhooks/cinetpay.webhook")
);

// =======================
// 🔹 Page d’accueil
// =======================
app.get("/", (req, res) => {
  res.json({
    message: "🚀 API Marketplace — VERSION AUTO DEPLOY",
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
// 🔹 IP du serveur (pour QOS / whitelist)
// =======================
app.get("/ip", (req, res) => {
  res.json({
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
  });
});

// =======================
// 🔹 Test GitHub App au démarrage
// =======================
(async () => {
  try {
    const octokit = await getGithubClient();
    const authData = await octokit.rest.apps.getAuthenticated();
    console.log("✅ GitHub App connectée :", authData.data.name);
  } catch (err) {
    console.error("❌ Erreur GitHub App :", err.message);
  }
})();

// =======================
// 🔹 Route GitHub : déclencher workflow
// =======================
app.post("/api/github/deploy", deployAuth, async (req, res) => {
  try {
    const octokit = await getGithubClient();

    await octokit.rest.actions.createWorkflowDispatch({
      owner: "DaneDev-art",
      repo: "backend-api",
      workflow_id: "deploy.yml",
      ref: "main",
    });

    res.json({ success: true, message: "Workflow déclenché" });
  } catch (err) {
    console.error("❌ Erreur GitHub :", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// 🔹 Gestion globale des erreurs
// =======================
app.use((err, req, res, next) => {
  if (err.message && err.message.includes("CORS")) {
    console.error("❌ [CORS ERROR]", err.message);
    return res.status(403).json({
      success: false,
      error: err.message,
    });
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
