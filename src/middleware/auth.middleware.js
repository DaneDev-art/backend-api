// ==========================================
// src/middleware/auth.middleware.js
// ==========================================
const jwt = require("jsonwebtoken");
const Seller = require("../models/Seller"); // 🔥 AJOUT

// ==========================================
// 🔐 Vérifier authentification utilisateur
// ==========================================
const verifyToken = (req, res, next) => {
  const authHeader =
    req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentification requise",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET manquant dans l'environnement");
    return res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload?.id && !payload?._id) {
      return res.status(401).json({
        success: false,
        error: "Token invalide",
      });
    }

    req.user = {
      _id: payload.id || payload._id,
      id: payload.id || payload._id,
      role: payload.role?.toLowerCase() || null,
      email: payload.email || null,

      phone:
        payload.phone ||
        payload.fullNumber ||
        payload.phoneNumber ||
        null,

      prefix: payload.prefix || null,
    };

    req.role = req.user.role;

    next();
  } catch (err) {
    console.error("❌ JWT error:", err.message);
    return res.status(401).json({
      success: false,
      error: "Session expirée ou invalide",
    });
  }
};

// ==========================================
// 🔐 Vérifier rôle administrateur
// ==========================================
const verifyAdmin = (req, res, next) => {
  const adminRoles = new Set([
    "admin_general",
    "admin_seller",
    "admin_delivery",
    "admin_buyer",
  ]);

  if (!req.role || !adminRoles.has(req.role)) {
    return res.status(403).json({
      success: false,
      error: "Accès administrateur requis",
    });
  }

  next();
};

// ==========================================
// 🔐 Vérifier rôle spécifique
// Usage : verifyRole(["buyer", "seller"])
// ==========================================
const verifyRole = (roles = []) => {
  const allowed = new Set(roles.map((r) => r.toLowerCase()));

  return (req, res, next) => {
    if (!req.role || !allowed.has(req.role)) {
      return res.status(403).json({
        success: false,
        error: "Accès refusé",
      });
    }
    next();
  };
};

// ==========================================
// 🔐 Vérifier abonnement vendeur
// ==========================================
const checkSellerSubscription = async (req, res, next) => {
  try {
    // Ne s'applique qu'aux vendeurs
    if (req.role !== "seller") {
      return next();
    }

    const seller = await Seller.findOne({ user: req.user._id });

    if (!seller) {
      return res.status(404).json({
        success: false,
        error: "Vendeur introuvable",
      });
    }

    const now = new Date();

    // Si pas encore de première vente → autorisé
    if (!seller.subscription?.firstSaleAt) {
      return next();
    }

    // Si abonnement actif → autorisé
    if (seller.subscription.status === "ACTIVE") {
      return next();
    }

    // Si période gratuite encore valide → autorisé
    if (
      seller.subscription.endAt &&
      now <= seller.subscription.endAt
    ) {
      return next();
    }

    // Sinon → expiré
    seller.subscription.status = "EXPIRED";
    await seller.save();

    return res.status(403).json({
      success: false,
      error: "Abonnement annuel expiré. Veuillez renouveler.",
      code: "SUBSCRIPTION_EXPIRED",
    });
  } catch (error) {
    console.error("❌ Subscription middleware error:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur vérification abonnement",
    });
  }
};

// ==========================================
// ✅ Export
// ==========================================
module.exports = {
  verifyToken,
  verifyAdmin,
  verifyRole,
  checkSellerSubscription, // 🔥 AJOUT EXPORT
};
