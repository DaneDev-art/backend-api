const jwt = require("jsonwebtoken");

// 🔹 Middleware pour vérifier que l'utilisateur est connecté
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ Middleware Auth: Token manquant ou mal formaté");
    return res.status(401).json({ message: "Token manquant" });
  }

  const token = authHeader.split(" ")[1];

  try {
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET non défini dans .env");
      return res.status(500).json({ message: "Erreur serveur: JWT_SECRET manquant" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Stocke les informations utiles dans req.user
    req.user = payload;
    req.userId = payload.id || payload._id;
    req.role = payload.role;

    next();
  } catch (err) {
    console.error("❌ JWT invalide:", err.message);
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

module.exports = {
  verifyToken,
  verifyAdmin,
};
