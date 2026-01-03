// middleware/cors.middleware.js
const cors = require("cors");

/**
 * CORS middleware – E-Market (prod ready)
 *
 * - Autorise Flutter Web (localhost ports dynamiques)
 * - Autorise frontend prod (Render)
 * - Autorise CinetPay / webhooks (no Origin)
 * - Bloque origines inconnues
 */

const allowedExactOrigins = [
  "https://emarket-web.onrender.com",
];

const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const corsOptions = {
  origin: function (origin, callback) {
    // 🔥 Requêtes sans Origin (CinetPay, Webhook, Postman, Server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // ✅ Origines exactes autorisées
    if (allowedExactOrigins.includes(origin)) {
      return callback(null, true);
    }

    // ✅ Flutter Web / Frontend local (ports dynamiques)
    if (localhostRegex.test(origin)) {
      return callback(null, true);
    }

    // ❌ Refus explicite
    console.error("❌ [CORS PROD] Origine refusée :", origin);
    return callback(new Error("Origine non autorisée par CORS"));
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
};

module.exports = corsOptions;
