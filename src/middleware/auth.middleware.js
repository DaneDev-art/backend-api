// ==========================================
// src/middleware/auth.middleware.js
// ==========================================
const jwt = require("jsonwebtoken");

// 🔹 Middleware pour vérifier que l'utilisateur est connecté
const verifyToken = (req, res, next) => {
  // Vérifie les deux variantes d'en-tête possibles
  const authHeader = req.headers.authorization || req.headers.Authorization;

  console.log("🧾 [DEBUG AUTH] Headers reçus:", req.headers);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ [DEBUG AUTH] Token manquant ou mal formaté:", authHeader);
    return res.status(401).json({ message: "Token manquant ou invalide" });
  }

  const token = authHeader.split(" ")[1];

  try {
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET non défini dans .env");
      return res.status(500).json({ message: "Erreur serveur: JWT_SECRET manquant" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ [DEBUG AUTH] Token décodé:", payload);

    // Stocke les informations utiles dans req.user
    req.user = {
      _id: payload.id || payload._id, // ✅ compatible avec Mongoose ObjectId
      role: payload.role,
      email: payload.email,
    };
    req.role = payload.role;

    next();
  } catch (err) {
    console.error("❌ [DEBUG AUTH] JWT invalide:", err.message);
    return res.status(401).json({ message: "Token invalide" });
  }
};

// 🔹 Middleware pour vérifier que l'utilisateur est un admin
const verifyAdmin = (req, res, next) => {
  const adminRoles = ["admin_general", "admin_seller", "admin_delivery", "admin_buyer"];

  if (!req.role) {
    return res.status(403).json({ message: "Rôle non défini" });
  }

  if (!adminRoles.includes(req.role)) {
    return res.status(403).json({ message: "Accès réservé aux administrateurs" });
  }

  next();
};

// 🔹 Middleware pour vérifier un rôle spécifique
const verifyRole = (roles = []) => (req, res, next) => {
  if (!req.role) {
    return res.status(403).json({ message: "Rôle non défini" });
  }
  if (!roles.includes(req.role)) {
    return res.status(403).json({ message: "Accès refusé pour ce rôle" });
  }
  next();
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyRole,
};
