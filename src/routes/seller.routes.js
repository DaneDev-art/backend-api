// src/routes/seller.routes.js
const express = require("express");
const router = express.Router();
const Seller = require("../models/Seller");
const jwt = require("jsonwebtoken");

// -------------------------
// Middleware d'authentification
// -------------------------
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Token manquant ou invalide" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // id, email, role
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Token invalide" });
  }
};

// -------------------------
// 🧾 Routes Seller
// -------------------------

// Créer un nouveau vendeur (protégé)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { email, phone } = req.body;

    // Éviter doublons
    const existing = await Seller.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ success: false, error: "Ce vendeur existe déjà" });
    }

    const seller = await Seller.create(req.body);
    res.status(201).json({ success: true, seller });
  } catch (err) {
    console.error("❌ Erreur création vendeur:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Récupérer tous les vendeurs
router.get("/", authMiddleware, async (req, res) => {
  try {
    const sellers = await Seller.find();
    res.json({ success: true, sellers });
  } catch (err) {
    console.error("❌ Erreur récupération vendeurs:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Récupérer un vendeur par ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ success: false, error: "Vendeur introuvable" });
    res.json({ success: true, seller });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mettre à jour un vendeur
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const seller = await Seller.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!seller) return res.status(404).json({ success: false, error: "Vendeur introuvable" });
    res.json({ success: true, seller });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
