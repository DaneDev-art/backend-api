const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
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

    // On peut stocker directement l'ID de l'utilisateur pour simplifier
    req.user = payload;
    req.userId = payload.id || payload._id; // selon ton JWT
    next();
  } catch (err) {
    console.error("❌ JWT invalide:", err.message);
    return res.status(401).json({ message: "Token invalide" });
  }
};
