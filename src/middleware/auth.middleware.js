// ==========================================
// src/middleware/auth.middleware.js
// ==========================================
const jwt = require("jsonwebtoken");

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

    // ======================================================
    // ✅ Injection utilisateur NORMALISÉE
    // ======================================================
    req.user = {
      _id: payload.id || payload._id,
      id: payload.id || payload._id,
      role: payload.role?.toLowerCase() || null,
      email: payload.email || null,

      // 🔥 IMPORTANT POUR QOSPAY
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
// ✅ Export
// ==========================================
module.exports = {
  verifyToken,
  verifyAdmin,
  verifyRole,
};
