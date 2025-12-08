// ===============================================
// src/middleware/aiRateLimit.js
// Rate limiting spécial IA (Chat, TTS, STT, Vision)
// ===============================================

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// =======================================================
// 💡 Rate-limit basé sur l'utilisateur
// Chaque user a son propre compteur
// =======================================================

function aiRateLimit({
  windowMs = 60 * 1000, // 1 minute
  max = 10,             // 10 requêtes IA/minute par utilisateur
  message = "Trop de requêtes IA. Veuillez patienter quelques instants.",
} = {}) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      // 🔒 Si utilisateur connecté → ID
      if (req.user?.id) return `user-${req.user.id}`;

      // 🔑 Sinon → IP correctement gérée IPv4/IPv6
      return ipKeyGenerator(req);
    },
    message,
    handler: (req, res) => {
      return res.status(429).json({
        error: true,
        message,
        retryAfter: Math.ceil(windowMs / 1000) + "s",
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = aiRateLimit;
