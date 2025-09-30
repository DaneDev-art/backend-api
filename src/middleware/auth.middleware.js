const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token manquant" });
  }

  const token = auth.split(" ")[1];

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET non défini dans .env");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error("❌ JWT error:", err.message);
    return res.status(401).json({ message: "Token invalide" });
  }
};
