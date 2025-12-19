// ==========================================
// src/middleware/auth.middleware.js
// ==========================================
const jwt = require("jsonwebtoken");

// 🔹 Middleware : vérifier que l'utilisateur est connecté
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token manquant ou invalide" });
  }

  const token = authHeader.split(" ")[1];

  try {
    if (!process.env.JWT_SECRET) {
      console.error("⚠️ JWT_SECRET manquant dans l'environnement !");
      return res
        .status(500)
        .json({ message: "Erreur serveur: JWT_SECRET manquant" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Données utilisateur injectées dans la requête
    req.user = {
      _id: payload.id || payload._id,
      id: payload.id || payload._id, // alias pratique
      role: payload.role,
      email: payload.email,
    };

    req.role = payload.role;

    next();
  } catch (err) {
    console.error("❌ Token invalide:", err.message);
    return res.status(401).json({ message: "Token invalide" });
  }
};

// 🔹 Middleware : vérifier que l'utilisateur est admin
const verifyAdmin = (req, res, next) => {
  const adminRoles = [
    "admin_general",
    "admin_seller",
    "admin_delivery",
    "admin_buyer",
  ];

  if (!req.role || !adminRoles.includes(req.role)) {
    return res
      .status(403)
      .json({ message: "Accès réservé aux administrateurs" });
  }

  next();
};

// 🔹 Middleware : vérifier un ou plusieurs rôles spécifiques
// Exemple : verifyRole(["buyer"]), verifyRole(["seller", "admin_seller"])
const verifyRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.role || !roles.includes(req.role)) {
      return res
        .status(403)
        .json({ message: "Accès refusé pour ce rôle" });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyRole,
};
