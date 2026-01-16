// src/middleware/referral.middleware.js

const User = require("../models/user.model");

/**
 * Middleware de validation du parrainage
 * - empêche l'auto-parrainage
 * - empêche le multi-parrainage
 * - limite le parrainage dans le temps
 * - valide les rôles
 */
const validateReferral = async (req, res, next) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user?.id;

    if (!referralCode) {
      return next(); // pas de parrainage → on laisse passer
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Utilisateur non authentifié",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable",
      });
    }

    // 🔒 Déjà parrainé
    if (user.referredBy) {
      return res.status(400).json({
        success: false,
        message: "Parrainage déjà appliqué",
      });
    }

    // ⏱️ Délai maximum (ex: 7 jours après inscription)
    const MAX_REFERRAL_DAYS = 7;
    const daysSinceSignup =
      (Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24);

    if (daysSinceSignup > MAX_REFERRAL_DAYS) {
      return res.status(400).json({
        success: false,
        message:
          "Le délai pour appliquer un parrainage est dépassé",
      });
    }

    const referrer = await User.findOne({
      referralCode,
    });

    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: "Code de parrainage invalide",
      });
    }

    // 🚫 Auto-parrainage
    if (referrer._id.equals(user._id)) {
      return res.status(400).json({
        success: false,
        message: "Auto-parrainage interdit",
      });
    }

    // 🎯 Rôles éligibles
    const allowedRoles = ["buyer", "seller", "delivery"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: "Rôle non éligible au parrainage",
      });
    }

    // Injecter le parrain pour le controller
    req.referrer = referrer;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateReferral,
};
