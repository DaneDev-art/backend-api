// ===============================================
// src/middleware/aiRateLimit.js
// Rate limiting spécial IA (Chat, TTS, STT, Vision)
// ===============================================

const rateLimit = require("express-rate-limit");

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
      // 🔒 Basé sur le token utilisateur
      return req.user?.id || req.ip;
    },
    message,
    handler: (req, res, next, options) => {
      return res.status(429).json({
        error: true,
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000) + "s",
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = aiRateLimit;
