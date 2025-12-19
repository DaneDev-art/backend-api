// src/routes/seller.routes.js
const express = require("express");
const router = express.Router();
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");
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

// Récupérer un vendeur par ID avec fonds bloqués et historique
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ success: false, error: "Vendeur introuvable" });

    // 🔹 Historique des fonds bloqués/libérés
    const transactions = await PayinTransaction.find({ sellerId: seller._id }).sort({ createdAt: -1 });

    const fundsHistory = transactions.map(tx => ({
      transactionId: tx.transaction_id,
      orderId: tx.orderId || null, // si vous liez transaction → commande
      amount: tx.netAmount,
      currency: tx.currency,
      status: tx.status,
      type: tx.status === "SUCCESS" ? "RELEASED" : "LOCKED",
      date: tx.createdAt,
    }));

    // 🔹 Calcul solde disponible / bloqué
    const balanceAvailable = fundsHistory
      .filter(f => f.type === "RELEASED")
      .reduce((sum, f) => sum + f.amount, 0);

    const balanceLocked = fundsHistory
      .filter(f => f.type === "LOCKED")
      .reduce((sum, f) => sum + f.amount, 0);

    res.json({
      success: true,
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        role: seller.role,
        balanceAvailable,
        balanceLocked,
        fundsHistory,
      },
    });
  } catch (err) {
    console.error("❌ Erreur récupération vendeur:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
