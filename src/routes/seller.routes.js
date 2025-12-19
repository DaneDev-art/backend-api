// src/routes/seller.routes.js
const express = require("express");
const router = express.Router();
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");
const jwt = require("jsonwebtoken");

// -------------------------
// 🔐 Middleware d'authentification
// -------------------------
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, error: "Token manquant ou invalide" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { id, email, role }
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Token invalide" });
  }
};

// ======================================================
// 👤 VENDEUR CONNECTÉ
// GET /api/sellers/me
// ======================================================
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // 🔑 IMPORTANT : Seller._id === User._id
    const sellerId = req.user.id;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        error: "Vendeur introuvable",
      });
    }

    // 🔹 Historique des transactions (fonds)
    const transactions = await PayinTransaction.find({
      sellerId: seller._id,
    }).sort({ createdAt: -1 });

    const fundsHistory = transactions.map(tx => ({
      transactionId: tx.transaction_id || null,
      orderId: tx.orderId || null,
      amount: tx.netAmount || 0,
      currency: tx.currency || "XOF",
      type: tx.status === "SUCCESS" ? "RELEASED" : "LOCKED",
      date: tx.createdAt,
    }));

    // 🔹 SOLDES : on prend la vérité depuis le document Seller
    const balanceAvailable = seller.balance_available || 0;
    const balanceLocked = seller.balance_locked || 0;

    return res.json({
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
    console.error("❌ GET /api/sellers/me:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération vendeur",
    });
  }
});

// ======================================================
// 🔍 VENDEUR PAR ID (TOUJOURS EN DERNIER)
// GET /api/sellers/:id
// ======================================================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        error: "Vendeur introuvable",
      });
    }

    const transactions = await PayinTransaction.find({
      sellerId: seller._id,
    }).sort({ createdAt: -1 });

    const fundsHistory = transactions.map(tx => ({
      transactionId: tx.transaction_id || null,
      orderId: tx.orderId || null,
      amount: tx.netAmount || 0,
      currency: tx.currency || "XOF",
      type: tx.status === "SUCCESS" ? "RELEASED" : "LOCKED",
      date: tx.createdAt,
    }));

    const balanceAvailable = seller.balance_available || 0;
    const balanceLocked = seller.balance_locked || 0;

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
    console.error("❌ GET /api/sellers/:id:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération vendeur",
    });
  }
});

module.exports = router;
